"use client";

import { LineChart, ChartLegend, Sparkline } from "@/components/charts/Charts";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetError, WidgetSkeleton } from "./WidgetStates";

export function CTLChart({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const { loadSeries } = data.training;
  const current = loadSeries.current;

  if (size === "S") {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-neutral-700">CTL {current.ctl.toFixed(0)}</p>
        <Sparkline values={loadSeries.ctl.slice(-30)} color="#0a84ff" width={80} height={28} />
      </div>
    );
  }

  if (size === "M") {
    const last30 = loadSeries.dates.slice(-30);
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="text-base font-semibold text-neutral-900">{current.ctl.toFixed(0)}</p>
            <p className="text-neutral-400">CTL</p>
          </div>
          <div>
            <p className="text-base font-semibold text-neutral-900">{current.atl.toFixed(0)}</p>
            <p className="text-neutral-400">ATL</p>
          </div>
          <div>
            <p className="text-base font-semibold text-neutral-900">
              {current.tsb > 0 ? "+" : ""}
              {current.tsb.toFixed(0)}
            </p>
            <p className="text-neutral-400">TSB</p>
          </div>
        </div>
        <Sparkline values={loadSeries.ctl.slice(-30)} color="#0a84ff" />
        <p className="text-[11px] text-neutral-400">CTL · letzte {last30.length} Tage</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div>
          <p className="text-base font-semibold text-neutral-900">{current.ctl.toFixed(0)}</p>
          <p className="text-neutral-400">CTL</p>
        </div>
        <div>
          <p className="text-base font-semibold text-neutral-900">{current.atl.toFixed(0)}</p>
          <p className="text-neutral-400">ATL</p>
        </div>
        <div>
          <p className="text-base font-semibold text-neutral-900">
            {current.tsb > 0 ? "+" : ""}
            {current.tsb.toFixed(0)}
          </p>
          <p className="text-neutral-400">TSB</p>
        </div>
        <div>
          <p className="text-base font-semibold text-neutral-900">{current.acwr ?? "—"}</p>
          <p className="text-neutral-400">ACWR</p>
        </div>
      </div>
      <LineChart
        labels={loadSeries.dates.slice(-90).map((d) => d.slice(5))}
        showZeroLine
        series={[
          { name: "Fitness (CTL)", color: "#0a84ff", values: loadSeries.ctl.slice(-90) },
          { name: "Ermüdung (ATL)", color: "#ff9f0a", values: loadSeries.atl.slice(-90) },
          { name: "Form (TSB)", color: "#34c759", values: loadSeries.tsb.slice(-90) },
        ]}
      />
      <ChartLegend
        items={[
          { name: "Fitness (CTL)", color: "#0a84ff" },
          { name: "Ermüdung (ATL)", color: "#ff9f0a" },
          { name: "Form (TSB)", color: "#34c759" },
        ]}
      />
    </div>
  );
}
