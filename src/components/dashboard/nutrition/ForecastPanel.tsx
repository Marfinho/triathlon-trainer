"use client";

import type { DailyEnergyForecast, EnergyForecastConfidence } from "@/domain/nutrition/forecast";
import type { FuelingHint } from "@/domain/nutrition/heuristics";

const CONFIDENCE_LABEL: Record<EnergyForecastConfidence, string> = {
  high: "hohe Konfidenz",
  medium: "mittlere Konfidenz",
  low: "niedrige Konfidenz",
};

const CONFIDENCE_COLOR: Record<EnergyForecastConfidence, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-neutral-200 text-neutral-600",
};

/**
 * Zeigt den geschätzten Energiebedarf der kommenden geplanten Einheiten –
 * jede Zahl trägt sichtbar ihre Konfidenz, keine Blackbox-Schätzung.
 */
export function ForecastPanel({
  byDay,
  hints,
}: {
  byDay: DailyEnergyForecast[];
  hints: FuelingHint[];
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Energiebedarf kommende Einheiten
      </p>
      {byDay.length === 0 ? (
        <p className="text-sm text-neutral-400">Keine geplanten Einheiten im Zeitraum.</p>
      ) : (
        <ul className="space-y-1.5">
          {byDay.map((d) => (
            <li
              key={d.date}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
            >
              <span className="text-neutral-700">
                {d.date}{" "}
                <span className="text-neutral-400">
                  ({d.workoutCount} {d.workoutCount === 1 ? "Einheit" : "Einheiten"})
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium text-neutral-900">≈{d.kcal} kcal</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CONFIDENCE_COLOR[d.confidence]}`}
                >
                  {CONFIDENCE_LABEL[d.confidence]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {hints.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {hints.map((h, i) => (
            <li
              key={i}
              className={`rounded-lg px-2.5 py-1.5 text-xs ${
                h.level === "notice" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"
              }`}
            >
              {h.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
