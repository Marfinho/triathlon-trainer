"use client";

import { Sparkline } from "@/components/charts/Charts";
import { interpretAcwr } from "@/domain/training/trainingLoad";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetError, WidgetSkeleton } from "./WidgetStates";

const FORM_COLOR: Record<string, string> = {
  fresh: "#34c759",
  optimal: "#30d158",
  neutral: "#0a84ff",
  tired: "#ff9f0a",
  overload: "#ff3b30",
};

export function FormGauge({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const { form, loadSeries } = data.training;
  const color = FORM_COLOR[form.state] ?? "#8e8e93";
  const { current } = loadSeries;

  if (size === "S") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-sm font-medium text-neutral-800">{form.label}</p>
        <p className="ml-auto text-sm text-neutral-500">TSB {current.tsb}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-sm font-medium text-neutral-800">{form.label}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <dt className="text-xs text-neutral-400">CTL</dt>
          <dd className="font-semibold text-neutral-900">{current.ctl}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-400">ATL</dt>
          <dd className="font-semibold text-neutral-900">{current.atl}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-400">TSB</dt>
          <dd className="font-semibold text-neutral-900">{current.tsb}</dd>
        </div>
      </dl>
      {size === "L" && (
        <>
          <div className="text-blue-500">
            <p className="mb-0.5 text-[11px] text-neutral-400">TSB-Verlauf (30 Tage)</p>
            <Sparkline values={loadSeries.tsb.slice(-30)} color="#0a84ff" height={36} />
          </div>
          <p className="text-xs text-neutral-500">
            ACWR {current.acwr ?? "—"} · {interpretAcwr(current.acwr).label}
          </p>
        </>
      )}
    </div>
  );
}
