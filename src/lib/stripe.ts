import Stripe from "stripe";

/** Stripe-Client (null, wenn STRIPE_SECRET_KEY nicht gesetzt ist). */
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null;

export type BillingInterval = "monthly" | "yearly" | "lifetime";

/** Liefert die konfigurierte Stripe-Price-ID je Intervall. */
export function priceIdFor(interval: BillingInterval): string | undefined {
  switch (interval) {
    case "monthly":
      return process.env.STRIPE_PRICE_MONTHLY;
    case "yearly":
      return process.env.STRIPE_PRICE_YEARLY;
    case "lifetime":
      return process.env.STRIPE_PRICE_LIFETIME;
  }
}
