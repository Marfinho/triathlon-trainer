import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { stripe, priceIdFor, type BillingInterval } from "@/lib/stripe";

/**
 * POST /api/billing/create-checkout
 * Body: { interval: "monthly" | "yearly" | "lifetime" }
 * Erstellt eine Stripe-Checkout-Session und gibt deren URL zurück.
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  if (!stripe) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
  }

  let interval: BillingInterval = "monthly";
  try {
    const body = await request.json();
    if (["monthly", "yearly", "lifetime"].includes(body?.interval)) {
      interval = body.interval;
    }
  } catch {
    /* Default */
  }

  const price = priceIdFor(interval);
  if (!price) {
    return NextResponse.json({ error: "PRICE_NOT_CONFIGURED" }, { status: 503 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: interval === "lifetime" ? "payment" : "subscription",
    line_items: [{ price, quantity: 1 }],
    customer: dbUser.stripeCustomerId ?? undefined,
    customer_email: dbUser.stripeCustomerId ? undefined : dbUser.email,
    client_reference_id: userId,
    metadata: { userId, interval },
    success_url: `${baseUrl}/dashboard?billing=success`,
    cancel_url: `${baseUrl}/#pricing`,
  });

  return NextResponse.json({ url: session.url });
}
