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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId =
      session.client_reference_id ?? session.metadata?.userId ?? null;
    const interval = (session.metadata?.interval ?? "monthly") as string;
    if (userId) {
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
