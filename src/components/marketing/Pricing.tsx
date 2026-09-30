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
      className="mt-0.5 h-4 w-4 shrink-0 text-[#39FF88]"
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
          className={`text-sm ${billing === "monthly" ? "text-[#F1F1FB]" : "text-[#8E8EAB]"}`}
        >
          monatlich
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={billing === "yearly"}
          aria-label="Abrechnungszeitraum umschalten"
          onClick={() => setBilling((b) => (b === "monthly" ? "yearly" : "monthly"))}
          className="relative h-7 w-12 rounded-full bg-[#27273B] transition"
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-[#00E5FF] transition-all ${
              billing === "yearly" ? "left-6" : "left-1"
            }`}
          />
        </button>
        <span
          className={`text-sm ${billing === "yearly" ? "text-[#F1F1FB]" : "text-[#8E8EAB]"}`}
        >
          jährlich
        </span>
        <span className="rounded-full bg-[#00E5FF]/10 px-2 py-0.5 text-xs font-medium text-[#00E5FF]">
          –20%
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Free */}
        <div className="flex flex-col rounded-2xl border border-[#27273B] bg-white p-7">
          <h3 className="text-lg font-semibold tracking-tight">Free</h3>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-semibold tracking-tight">€0</span>
            <span className="text-sm text-[#8E8EAB]">für immer</span>
          </div>
          <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-[#9A9AB8]">
            {freeFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/auth/register"
            className="mt-7 w-full rounded-full border border-[#34344D] px-4 py-2.5 text-center text-sm font-medium text-[#F1F1FB] transition hover:border-[#8E8EAB]"
          >
            Kostenlos starten
          </Link>
        </div>

        {/* Pro (recommended) */}
        <div className="relative flex flex-col rounded-2xl border-2 border-[#00E5FF] bg-white p-7 shadow-[0_8px_40px_-12px_rgba(0,113,227,0.3)]">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#00E5FF] px-3 py-1 text-xs font-medium text-white">
            Empfohlen
          </span>
          <h3 className="text-lg font-semibold tracking-tight">Pro</h3>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-semibold tracking-tight">€{proPrice}</span>
            <span className="text-sm text-[#8E8EAB]">{proPeriod}</span>
          </div>
          <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-[#9A9AB8]">
            {proFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/auth/register"
            className="mt-7 w-full rounded-full bg-[#00E5FF] px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-[#00C8FF]"
          >
            Pro holen
          </Link>
        </div>

        {/* Lifetime */}
        <div className="flex flex-col rounded-2xl border border-[#27273B] bg-white p-7">
          <h3 className="text-lg font-semibold tracking-tight">Lifetime</h3>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-semibold tracking-tight">€149</span>
            <span className="text-sm text-[#8E8EAB]">einmalig</span>
          </div>
          <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-[#9A9AB8]">
            {lifetimeFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/auth/register"
            className="mt-7 w-full rounded-full border border-[#34344D] px-4 py-2.5 text-center text-sm font-medium text-[#F1F1FB] transition hover:border-[#8E8EAB]"
          >
            Lifetime kaufen
          </Link>
        </div>
      </div>
    </div>
  );
}
