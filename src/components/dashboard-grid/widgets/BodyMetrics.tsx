"use client";

import { Sparkline } from "@/components/charts/Charts";
import { summarizeBody, trendLabel } from "@/domain/training/body";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./WidgetStates";

const TREND_ARROW: Record<string, string> = {
  steigend: "↑",
  fallend: "↓",
  stabil: "→",
};

export function BodyMetrics({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const { history } = data.body;
  if (history.length === 0) {
    return <WidgetEmpty message="Noch keine Körperwerte erfasst." />;
  }

  const summary = summarizeBody(history);
  const weightTrend = trendLabel(summary.weights);
  const hrTrend = trendLabel(summary.restingHrs);

  if (size === "S") {
    return (
      <p className="text-sm text-neutral-700">
        {summary.latestWeight != null ? `${summary.latestWeight} kg` : "—"}
        {summary.latestRestingHr != null ? ` · ${summary.latestRestingHr} bpm` : ""}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="text-base font-semibold text-neutral-900">
            {summary.latestWeight ?? "—"}
          </p>
          <p className="text-neutral-400">
            kg {weightTrend ? TREND_ARROW[weightTrend] : ""}
          </p>
        </div>
        <div>
          <p className="text-base font-semibold text-neutral-900">
            {summary.latestRestingHr ?? "—"}
          </p>
          <p className="text-neutral-400">
            RHR {hrTrend ? TREND_ARROW[hrTrend] : ""}
          </p>
        </div>
        <div>
          <p className="text-base font-semibold text-neutral-900">{summary.latestHrv ?? "—"}</p>
          <p className="text-neutral-400">HRV</p>
        </div>
      </div>
      {size === "L" && (
        <div className="space-y-2 border-t border-neutral-100 pt-2">
          <div>
            <p className="mb-1 text-[11px] text-neutral-400">Gewicht</p>
            <Sparkline values={summary.weights} color="#0a84ff" />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-neutral-400">Ruhepuls</p>
            <Sparkline values={summary.restingHrs} color="#ff9f0a" />
          </div>
        </div>
      )}
    </div>
  );
}
