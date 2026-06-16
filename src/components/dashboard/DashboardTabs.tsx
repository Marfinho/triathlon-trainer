"use client";

import { useState, type ReactNode } from "react";

export interface DashboardTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Schlichte Tab-Navigation, um das Dashboard in ruhige Ansichten zu gliedern
 * (statt einer endlosen Karten-Liste). Die Inhalte werden serverseitig gerendert
 * und hier nur umgeschaltet.
 */
export function DashboardTabs({ tabs }: { tabs: DashboardTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <nav className="sticky top-0 z-10 -mx-6 mb-6 border-b border-neutral-200/70 bg-[#f5f5f7]/85 px-6 py-2.5 backdrop-blur">
        <div className="inline-flex flex-wrap gap-0.5 rounded-xl border border-neutral-200 bg-white p-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                current?.id === t.id
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <div className="space-y-5">{current?.content}</div>
    </div>
  );
}
