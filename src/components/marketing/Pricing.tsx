"use client";

import { useState } from "react";
import Link from "next/link";

type Billing = "monthly" | "yearly";

function Check() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
    >
      <path
        d="M4 10.5l4 4 8-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const freeFeatures = [
  "Intervals.icu-Sync",
  "Form & Belastung (CTL/ATL/TSB)",
  "Trainingszonen & Rechner",
  "Geräte-Tracking",
  "Bis zu 90 Tage Historie",
];

const proFeatures = [
  "Alles aus Free",
  "Wettkampf-Vorhersage",
  "Unbegrenzte Datenpunkte",
  "Backup & Export",
  "Alle Integrationen",
  "Priorisierter Support",
];

const lifetimeFeatures = [
  "Alles aus Pro",
  "Einmalig zahlen, für immer nutzen",
  "Alle zukünftigen Updates",
  "Kein Abo, kein Vendor-Lock",
];

export default function Pricing() {
  const [billing, setBilling] = useState<Billing>("monthly");

  const proPrice = billing === "monthly" ? "9" : "86";
  const proPeriod = billing === "monthly" ? "/Monat" : "/Jahr";

  return (
    <div>
      {/* Toggle */}
      <div className="mb-12 flex items-center justify-center gap-3">
        <span
          className={`text-sm font-semibold ${billing === "monthly" ? "text-neutral-900" : "text-neutral-400"}`}
        >
          monatlich
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={billing === "yearly"}
          aria-label="Abrechnungszeitraum umschalten"
          onClick={() => setBilling((b) => (b === "monthly" ? "yearly" : "monthly"))}
          className={`relative h-8 w-14 rounded-full transition-colors ${billing === "yearly" ? "bg-brand" : "bg-neutral-200"}`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              billing === "yearly" ? "left-7" : "left-1"
            }`}
          />
        </button>
        <span
          className={`text-sm font-semibold ${billing === "yearly" ? "text-neutral-900" : "text-neutral-400"}`}
        >
          jährlich
        </span>
        <span className="-rotate-3 rounded-full bg-lime-pop px-2.5 py-1 text-xs font-bold text-ink">
          –20%
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Free */}
        <div className="card-neon flex flex-col rounded-[28px] p-7">
          <h3 className="text-lg font-bold tracking-tight">Free</h3>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-[family-name:var(--font-display-sans)] text-5xl font-extrabold tracking-tight">€0</span>
            <span className="text-sm text-neutral-500">für immer</span>
          </div>
          <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-neutral-600">
            {freeFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/auth/register"
            className="btn-soft mt-7 w-full px-4 py-3 text-sm"
          >
            Kostenlos starten
          </Link>
        </div>

        {/* Pro (recommended) */}
        <div className="relative flex flex-col rounded-[28px] border-2 border-brand bg-white p-7 shadow-[var(--shadow-card-hover)] md:-translate-y-3">
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rotate-[-2deg] rounded-full bg-coral px-3 py-1 text-xs font-bold text-ink shadow-md">
            Beliebt ⭐
          </span>
          <h3 className="text-lg font-bold tracking-tight">Pro</h3>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-[family-name:var(--font-display-sans)] text-5xl font-extrabold tracking-tight">€{proPrice}</span>
            <span className="text-sm text-neutral-500">{proPeriod}</span>
          </div>
          <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-neutral-600">
            {proFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/auth/register"
            className="btn-pop mt-7 w-full px-4 py-3 text-sm"
          >
            Pro holen
          </Link>
        </div>

        {/* Lifetime */}
        <div className="card-neon flex flex-col rounded-[28px] p-7">
          <h3 className="text-lg font-bold tracking-tight">Lifetime</h3>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-[family-name:var(--font-display-sans)] text-5xl font-extrabold tracking-tight">€149</span>
            <span className="text-sm text-neutral-500">einmalig</span>
          </div>
          <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-neutral-600">
            {lifetimeFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/auth/register"
            className="btn-soft mt-7 w-full px-4 py-3 text-sm"
          >
            Lifetime kaufen
          </Link>
        </div>
      </div>
    </div>
  );
}
