"use client";

import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./WidgetStates";

const STATUS_LABEL: Record<string, string> = {
  planned: "geplant",
  synced: "synchronisiert",
  completed: "erfüllt",
  skipped: "übersprungen",
};

const STATUS_COLOR: Record<string, string> = {
  completed: "text-emerald-600",
  skipped: "text-rose-500",
};

export function Compliance({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const { planned } = data.week;
  const total = planned.length;
  if (total === 0) {
    return <WidgetEmpty message="Keine geplanten Einheiten diese Woche." />;
  }

  const completed = planned.filter((p) => p.status === "completed").length;
  const percent = Math.round((completed / total) * 100);

  if (size === "S") {
    return (
      <p className="text-sm text-neutral-700">
        {completed}/{total} Einheiten <span className="text-neutral-400">({percent}%)</span>
      </p>
    );
  }

  const plannedMin = planned.reduce((sum, p) => sum + p.plannedDurationMin, 0);
  const completedMin = planned
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.plannedDurationMin, 0);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-neutral-800">
          {completed}/{total} Einheiten erfüllt ({percent}%)
        </p>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        {completedMin} von {plannedMin} geplanten Minuten
      </p>
      {size === "L" && (
        <ul className="space-y-1 text-xs">
          {planned.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-neutral-600">{p.title}</span>
              <span className={STATUS_COLOR[p.status] ?? "text-neutral-400"}>
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
