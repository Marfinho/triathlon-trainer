"use client";

import { formatDuration } from "@/domain/training/prediction";
import { forecastTriathlons } from "@/domain/training/performanceModel";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./WidgetStates";

export function RacePrediction({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const forecasts = forecastTriathlons(data.performanceModel);
  const anyComplete = forecasts.some((f) => f.total != null);

  if (!anyComplete) {
    return (
      <WidgetEmpty message="Für eine Prognose werden Daten in allen drei Disziplinen benötigt (Aktivitäten oder Schwellenwerte)." />
    );
  }

  const range = (fast: number, slow: number) => `${formatDuration(fast)}–${formatDuration(slow)}`;

  if (size === "S") {
    const best = forecasts.find((f) => f.key === "olympic") ?? forecasts[0];
    return (
      <p className="text-sm text-neutral-700">
        {best.label}: {best.total ? range(best.total.fastSec, best.total.slowSec) : "—"}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {forecasts.map((f) => (
        <div key={f.key} className="flex items-center justify-between gap-2 text-sm">
          <span className="text-neutral-600">{f.label}</span>
          <span className="text-right">
            <span className="font-medium tabular-nums text-neutral-900">
              {formatDuration(f.total?.likelySec ?? null)}
            </span>
            {f.total ? (
              <span className="ml-1.5 text-[11px] tabular-nums text-neutral-400">
                ({range(f.total.fastSec, f.total.slowSec)})
              </span>
            ) : null}
          </span>
        </div>
      ))}
      {size === "L" && (
        <div className="mt-2 space-y-2 border-t border-neutral-100 pt-2">
          {forecasts
            .filter((f) => f.total != null)
            .map((f) => (
              <div key={f.key} className="text-xs text-neutral-500">
                <p className="font-medium text-neutral-700">{f.label}</p>
                <p>
                  Schwimmen {formatDuration(f.swim?.likelySec ?? null)} · Rad{" "}
                  {formatDuration(f.bike?.likelySec ?? null)}
                  {f.bikeTarget?.watts != null ? ` (${f.bikeTarget.watts} W)` : ""} · Laufen{" "}
                  {formatDuration(f.run?.likelySec ?? null)}
                  {f.runPaceSecPerKm
                    ? ` (${formatDuration(f.runPaceSecPerKm.fastSec)}–${formatDuration(f.runPaceSecPerKm.slowSec)} /km)`
                    : ""}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
