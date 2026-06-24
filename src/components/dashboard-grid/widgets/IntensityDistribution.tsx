"use client";

import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./WidgetStates";

const MODEL_LABEL: Record<string, string> = {
  polarisiert: "Polarisiert",
  pyramidal: "Pyramidal",
  schwellenlastig: "Schwellenlastig",
  unklar: "Unklar",
};

const BAND_COLOR: Record<string, string> = {
  easy: "#34c759",
  moderate: "#ff9f0a",
  hard: "#ff3b30",
};

export function IntensityDistribution({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const { intensity } = data.analysis;
  if (intensity.sampleCount === 0) {
    return <WidgetEmpty message="Noch keine Einheiten mit RPE erfasst." />;
  }

  if (size === "S") {
    return (
      <p className="text-sm text-neutral-700">
        {intensity.easyPct}% locker · {intensity.hardPct}% hart
      </p>
    );
  }

  const bands: { key: "easy" | "moderate" | "hard"; label: string; pct: number }[] = [
    { key: "easy", label: "Locker", pct: intensity.easyPct },
    { key: "moderate", label: "Moderat", pct: intensity.moderatePct },
    { key: "hard", label: "Hart", pct: intensity.hardPct },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {bands.map((b) => (
          <div
            key={b.key}
            title={`${b.label} · ${b.pct}%`}
            style={{ width: `${b.pct}%`, backgroundColor: BAND_COLOR[b.key] }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {bands.map((b) => (
          <span key={b.key} className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: BAND_COLOR[b.key] }}
            />
            {b.label} {b.pct}%
          </span>
        ))}
      </div>
      {size === "L" && (
        <p className="text-xs text-neutral-500">
          Modell: <span className="font-medium text-neutral-700">{MODEL_LABEL[intensity.model]}</span> ·
          {" "}
          {intensity.sampleCount} Einheiten mit RPE
        </p>
      )}
    </div>
  );
}
