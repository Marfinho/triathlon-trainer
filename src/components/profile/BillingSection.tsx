"use client";

import { useState } from "react";
import { Card } from "@/components/dashboard/Card";

type Interval = "monthly" | "yearly" | "lifetime";

const OPTIONS: { id: Interval; label: string; price: string; period: string }[] = [
  { id: "monthly", label: "Monatlich", price: "€9", period: "/Monat" },
  { id: "yearly", label: "Jährlich", price: "€86", period: "/Jahr · –20%" },
  { id: "lifetime", label: "Lifetime", price: "€149", period: "einmalig" },
];

export function BillingSection({
  plan,
  planInterval,
  planExpiresAt,
  hasStripeCustomer,
}: {
  plan: string;
  planInterval: string | null;
  planExpiresAt: string | null;
  hasStripeCustomer: boolean;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upgrade(interval: Interval) {
    setLoading(interval);
    setError(null);
    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(
          data.error === "STRIPE_NOT_CONFIGURED" || data.error === "PRICE_NOT_CONFIGURED"
            ? "Zahlungen sind derzeit nicht verfügbar."
            : "Checkout konnte nicht gestartet werden.",
        );
      }
    } finally {
      setLoading(null);
    }
  }

  async function manageSubscription() {
    setLoading("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError("Verwaltung konnte nicht geöffnet werden.");
      }
    } finally {
      setLoading(null);
    }
  }

  const isPaid = plan === "paid";

  return (
    <Card
      title="Tarif & Abrechnung"
      subtitle={isPaid ? "Du bist auf dem Pro-Tarif" : "Du nutzt den kostenlosen Free-Tarif"}
    >
      <div className="mb-4 flex items-center gap-3 rounded-xl bg-neutral-50 px-4 py-3">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
            isPaid ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"
          }`}
        >
          {isPaid ? "Pro" : "Free"}
        </span>
        {isPaid && planInterval && (
          <span className="text-sm text-neutral-600">
            {planInterval === "monthly" && "Monatliches Abo"}
            {planInterval === "yearly" && "Jährliches Abo"}
            {planInterval === "lifetime" && "Lifetime-Zugang"}
          </span>
        )}
        {isPaid && planExpiresAt && planInterval !== "lifetime" && (
          <span className="text-xs text-neutral-400">
            verlängert sich am {new Date(planExpiresAt).toLocaleDateString("de-DE")}
          </span>
        )}
      </div>

      {isPaid ? (
        hasStripeCustomer ? (
          <button
            onClick={manageSubscription}
            disabled={loading !== null}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-400 disabled:opacity-40"
          >
            {loading === "portal" ? "…" : "Abo verwalten"}
          </button>
        ) : null
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OPTIONS.map((o) => (
            <div key={o.id} className="rounded-xl border border-neutral-200 p-4">
              <p className="text-sm font-medium text-neutral-900">{o.label}</p>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-semibold text-neutral-900">{o.price}</span>
                <span className="text-xs text-neutral-400">{o.period}</span>
              </p>
              <button
                onClick={() => upgrade(o.id)}
                disabled={loading !== null}
                className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
              >
                {loading === o.id ? "…" : "Upgraden"}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </Card>
  );
}
