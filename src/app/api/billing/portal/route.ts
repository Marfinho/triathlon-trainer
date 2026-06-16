import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/billing/portal – Stripe Customer Portal Session (Abo-Verwaltung).
 */
export async function POST() {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  if (!stripe) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!dbUser?.stripeCustomerId) {
    return NextResponse.json({ error: "NO_CUSTOMER" }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: dbUser.stripeCustomerId,
    return_url: `${baseUrl}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
