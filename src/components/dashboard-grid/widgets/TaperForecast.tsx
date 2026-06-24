"use client";

import { ChartLegend, LineChart } from "@/components/charts/Charts";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./WidgetStates";

const VERDICT_STYLE: Record<string, { label: string; className: string }> = {
  optimal: { label: "Optimaler Taper", className: "text-emerald-600" },
  zu_muede: { label: "Noch zu müde", className: "text-amber-600" },
  zu_frisch: { label: "Zu stark getapert", className: "text-blue-600" },
  kein_renntag: { label: "Kein Renntag", className: "text-neutral-400" },
};

export function TaperForecast({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const { taper } = data;
  if (!taper || taper.series.length === 0) {
    return <WidgetEmpty message="Noch keine geplanten Workouts für eine Vorhersage." />;
  }

  const style = VERDICT_STYLE[taper.verdict] ?? VERDICT_STYLE.kein_renntag;

  if (size === "S") {
    return <p className={`text-sm font-medium ${style.className}`}>{style.label}</p>;
  }

  const raceDay = taper.raceDay;

  return (
    <div className="space-y-3">
      <p className={`text-sm font-medium ${style.className}`}>{style.label}</p>
      {raceDay && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="text-base font-semibold text-neutral-900">{raceDay.ctl.toFixed(0)}</p>
            <p className="text-neutral-400">CTL</p>
          </div>
          <div>
            <p className="text-base font-semibold text-neutral-900">{raceDay.atl.toFixed(0)}</p>
            <p className="text-neutral-400">ATL</p>
          </div>
          <div>
            <p className="text-base font-semibold text-neutral-900">
              {raceDay.tsb > 0 ? "+" : ""}
              {raceDay.tsb.toFixed(0)}
            </p>
            <p className="text-neutral-400">TSB</p>
          </div>
        </div>
      )}
      {size === "L" && (
        <div>
          <LineChart
            labels={taper.series.map((p) => p.date.slice(5))}
            showZeroLine
            series={[
              { name: "Fitness (CTL)", color: "#0a84ff", values: taper.series.map((p) => p.ctl) },
              { name: "Ermüdung (ATL)", color: "#ff9f0a", values: taper.series.map((p) => p.atl) },
              { name: "Form (TSB)", color: "#34c759", values: taper.series.map((p) => p.tsb) },
            ]}
          />
          <div className="mt-1.5">
            <ChartLegend
              items={[
                { name: "Fitness (CTL)", color: "#0a84ff" },
                { name: "Ermüdung (ATL)", color: "#ff9f0a" },
                { name: "Form (TSB)", color: "#34c759" },
              ]}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">{taper.recommendation}</p>
        </div>
      )}
    </div>
  );
}
