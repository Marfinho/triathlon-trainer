import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/billing/webhook – Stripe-Webhook (öffentlich, signaturgeprüft).
 *   - checkout.session.completed       -> Plan auf "paid" setzen
 *   - customer.subscription.deleted    -> Plan auf "free" zurücksetzen
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "NO_SIGNATURE" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    return NextResponse.json(
      { error: "INVALID_SIGNATURE", details: e instanceof Error ? e.message : "" },
      { status: 400 },
    );
  }

  // Idempotenz: Stripe sendet Events bei Netzwerkproblemen erneut. Jedes
  // Event darf nur einmal angewendet werden. Der Unique-Constraint auf `id`
  // macht das auch unter Race-Conditions sicher (zweiter Versuch schlägt
  // beim Create fehl -> als Duplikat behandelt).
  try {
    await prisma.stripeProcessedEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId =
      session.client_reference_id ?? session.metadata?.userId ?? null;
    const interval = (session.metadata?.interval ?? "monthly") as string;
    if (userId) {
      // client_reference_id wird ausschließlich von uns selbst beim Erzeugen
      // der Checkout-Session gesetzt (create-checkout/route.ts) – ein Angreifer
      // kann ein Event nicht ohne den Stripe-Signing-Secret fälschen. Dennoch
      // gegen die DB validieren, statt blind zu schreiben (verhindert 500er
      // bei gelöschten/ungültigen IDs und verschluckt keine Fehler stillschweigend).
      const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (exists) {
        let planExpiresAt: Date | null = null;
        let subscriptionId: string | null = null;
        if (session.mode === "subscription" && session.subscription) {
          subscriptionId = String(session.subscription);
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          planExpiresAt = sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : null;
        }
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: "paid",
            planInterval: interval,
            stripeCustomerId: session.customer ? String(session.customer) : undefined,
            stripeSubscriptionId: subscriptionId ?? undefined,
            planExpiresAt,
          },
        });
      }
    }
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = String(sub.customer);
    const dbUser = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
    if (dbUser) {
      // Aktive/trialing Subs: Ablaufdatum aus der aktuellen Periode aktualisieren.
      // Alles andere (canceled, unpaid, incomplete_expired, past_due nach Ablauf
      // der Kulanzfrist) -> sofort auf "free" zurückstufen, statt auf das
      // spätere subscription.deleted-Event zu warten.
      if (sub.status === "active" || sub.status === "trialing") {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            plan: "paid",
            planExpiresAt: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
          },
        });
      } else if (sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired") {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { plan: "free", planInterval: null, stripeSubscriptionId: null, planExpiresAt: null },
        });
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = String(sub.customer);
    const dbUser = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (dbUser) {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          plan: "free",
          planInterval: null,
          stripeSubscriptionId: null,
          planExpiresAt: null,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
