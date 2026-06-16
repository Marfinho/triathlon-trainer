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
      className="mt-0.5 h-4 w-4 shrink-0 text-[#22C55E]"
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
      <div className="mb-10 flex items-center justify-center gap-3">
        <span
          className={`font-display text-sm ${
            billing === "monthly" ? "text-[#F8FAFC]" : "text-[#94A3B8]"
          }`}
        >
          monatlich
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={billing === "yearly"}
          aria-label="Abrechnungszeitraum umschalten"
          onClick={() =>
            setBilling((b) => (b === "monthly" ? "yearly" : "monthly"))
          }
          className="relative h-7 w-12 rounded-full border border-[#334155] bg-[#111827] transition"
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-[#F0A500] transition-all ${
              billing === "yearly" ? "left-6" : "left-1"
            }`}
          />
        </button>
        <span
          className={`font-display text-sm ${
            billing === "yearly" ? "text-[#F8FAFC]" : "text-[#94A3B8]"
          }`}
        >
          jährlich
        </span>
        <span className="rounded-full border border-[#F0A500] px-2 py-0.5 font-display text-xs text-[#F0A500]">
          –20%
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Free */}
        <div className="flex flex-col rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
          <h3 className="text-lg font-semibold">Free</h3>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-display text-4xl font-medium">€0</span>
            <span className="text-sm text-[#94A3B8]">für immer</span>
          </div>
          <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-[#94A3B8]">
            {freeFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/auth/register"
            className="mt-6 w-full rounded-lg border border-[#334155] px-4 py-2.5 text-center font-medium text-[#F8FAFC] transition hover:border-[#475569]"
          >
            Kostenlos starten
          </Link>
        </div>

        {/* Pro (recommended) */}
        <div className="relative flex flex-col rounded-2xl border-2 border-[#F0A500] bg-[#111827] p-6 shadow-[0_0_40px_-12px_rgba(240,165,0,0.4)]">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#F0A500] px-3 py-1 font-display text-xs font-medium text-[#0B1120]">
            Empfohlen
          </span>
          <h3 className="text-lg font-semibold">Pro</h3>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-display text-4xl font-medium">€{proPrice}</span>
            <span className="text-sm text-[#94A3B8]">{proPeriod}</span>
          </div>
          <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-[#94A3B8]">
            {proFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/auth/register"
            className="mt-6 w-full rounded-lg bg-[#F0A500] px-4 py-2.5 text-center font-medium text-[#0B1120] transition hover:bg-[#ffb81f]"
          >
            Pro holen
          </Link>
        </div>

        {/* Lifetime */}
        <div className="flex flex-col rounded-2xl border border-[#1E293B] bg-[#111827] p-6">
          <h3 className="text-lg font-semibold">Lifetime</h3>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-display text-4xl font-medium">€149</span>
            <span className="text-sm text-[#94A3B8]">einmalig</span>
          </div>
          <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-[#94A3B8]">
            {lifetimeFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/auth/register"
            className="mt-6 w-full rounded-lg border border-[#334155] px-4 py-2.5 text-center font-medium text-[#F8FAFC] transition hover:border-[#475569]"
          >
            Lifetime kaufen
          </Link>
        </div>
      </div>
    </div>
  );
}
