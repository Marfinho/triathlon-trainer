"use client";

import { useState } from "react";
import Link from "next/link";

export interface OnboardingStep {
  key: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

/** „Erste Schritte“ für neue Nutzer; verschwindet, sobald alles erledigt oder ausgeblendet ist. */
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const done = steps.filter((s) => s.done).length;

  async function dismiss() {
    setHidden(true);
    await fetch("/api/profile/onboarding", { method: "POST" }).catch(() => undefined);
  }

  return (
    <section className="mb-6 rounded-3xl border border-blue-100 bg-blue-50/60 p-5" aria-label="Erste Schritte">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Erste Schritte</h2>
          <p className="text-sm text-neutral-600">{done} von {steps.length} erledigt</p>
        </div>
        <button onClick={dismiss} className="text-xs font-medium text-neutral-500 hover:text-neutral-800">
          Ausblenden
        </button>
      </div>
      <ul className="mt-4 space-y-2">
        {steps.map((s) => (
          <li key={s.key}>
            <Link href={s.href} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 transition hover:shadow-sm">
              <span aria-hidden="true" className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${s.done ? "bg-emerald-500 text-white" : "border border-neutral-300 text-transparent"}`}>✓</span>
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${s.done ? "text-neutral-400 line-through" : "text-neutral-900"}`}>{s.label}</span>
                {!s.done && <span className="block text-xs text-neutral-500">{s.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
