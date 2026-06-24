"use client";

import { ChartLegend, StackedBarChart } from "@/components/charts/Charts";
import { sportColor, sportLabel } from "@/components/dashboard/Card";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./WidgetStates";

export function VolumeByDiscipline({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const { weeklyVolume } = data.training;
  const current = weeklyVolume[weeklyVolume.length - 1];
  if (!current || current.totalMin === 0) {
    return <WidgetEmpty message="Noch kein Volumen diese Woche." />;
  }

  const sports = Object.keys(current.bySport).sort(
    (a, b) => current.bySport[b] - current.bySport[a],
  );

  if (size === "S") {
    return <p className="text-sm text-neutral-700">{current.totalMin} min diese Woche</p>;
  }

  const breakdown = (
    <div className="space-y-1.5">
      {sports.map((sport) => (
        <div key={sport} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: sportColor(sport) }}
          />
          <span className="flex-1 text-neutral-600">{sportLabel(sport)}</span>
          <span className="font-medium text-neutral-900">{current.bySport[sport]} min</span>
        </div>
      ))}
    </div>
  );

  if (size === "M") return breakdown;

  const weeks = weeklyVolume.slice(-8);
  const totalsBySport: Record<string, number> = {};
  for (const w of weeks) {
    for (const [sport, min] of Object.entries(w.bySport)) {
      totalsBySport[sport] = (totalsBySport[sport] ?? 0) + min;
    }
  }
  const allSports = Object.keys(totalsBySport).sort(
    (a, b) => totalsBySport[b] - totalsBySport[a],
  );
  const series = allSports.map((sport) => ({ name: sportLabel(sport), color: sportColor(sport) }));
  const labels = weeks.map((w) => w.weekStart.slice(5));
  const chartData = weeks.map((w) => allSports.map((sport) => w.bySport[sport] ?? 0));

  return (
    <div className="space-y-3">
      {breakdown}
      <div>
        <p className="mb-1 text-[11px] text-neutral-400">Letzte Wochen</p>
        <StackedBarChart labels={labels} series={series} data={chartData} height={140} unit="min" />
        <div className="mt-1.5">
          <ChartLegend items={series} />
        </div>
      </div>
    </div>
  );
}
