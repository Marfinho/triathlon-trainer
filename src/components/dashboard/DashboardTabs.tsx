"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface DashboardTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Schlichte Tab-Navigation, um das Dashboard in ruhige Ansichten zu gliedern
 * (statt einer endlosen Karten-Liste). Die Inhalte werden serverseitig gerendert
 * und hier nur umgeschaltet. Tastatur: Zifferntasten 1–9 springen direkt zu
 * einem Tab, ←/→ wechseln zum vorherigen/nächsten.
 */
export function DashboardTabs({ tabs }: { tabs: DashboardTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Shortcuts nur abseits von Eingabefeldern auslösen.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const idx = tabs.findIndex((t) => t.id === (current?.id ?? ""));
      if (/^[1-9]$/.test(e.key)) {
        const n = Number(e.key) - 1;
        if (n < tabs.length) {
          setActive(tabs[n].id);
          e.preventDefault();
        }
      } else if (e.key === "ArrowRight" && idx < tabs.length - 1) {
        setActive(tabs[idx + 1].id);
        e.preventDefault();
      } else if (e.key === "ArrowLeft" && idx > 0) {
        setActive(tabs[idx - 1].id);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs, current?.id]);

  return (
    <div>
      <nav
        className="sticky top-0 z-10 -mx-6 mb-6 border-b border-neutral-200/70 bg-[#f5f5f7]/85 px-6 py-2.5 backdrop-blur"
        aria-label="Dashboard-Bereiche"
      >
        <div
          className="inline-flex flex-wrap gap-0.5 rounded-xl border border-neutral-200 bg-white p-0.5"
          role="tablist"
        >
          {tabs.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              role="tab"
              aria-selected={current?.id === t.id}
              title={`${t.label} (Taste ${i + 1})`}
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
