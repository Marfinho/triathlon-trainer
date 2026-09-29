"use client";

import { useEffect, useState } from "react";
import {
  applyThemePreference,
  readThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
];

/**
 * Umschalter für die Darstellung (System/Hell/Dunkel). Bei „System" folgt die
 * App live der Betriebssystem-Einstellung.
 */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    setPref(readThemePreference());
  }, []);

  useEffect(() => {
    if (pref !== "system" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemePreference("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  function choose(value: ThemePreference) {
    setPref(value);
    applyThemePreference(value);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Darstellung"
      className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 dark:border-neutral-800 dark:bg-neutral-800"
    >
      {OPTIONS.map((o) => {
        const active = pref === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(o.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-600 dark:text-neutral-50"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
