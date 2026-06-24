"use client";

import { sportLabel } from "@/components/dashboard/Card";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./WidgetStates";

const STATUS_LABEL: Record<string, string> = {
  planned: "Geplant",
  synced: "Synchronisiert",
  completed: "Abgeschlossen",
  skipped: "Übersprungen",
};

export function TodayWorkout({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return <WidgetEmpty message="Keine Daten." />;

  const { planned, actual } = data.today;

  if (!planned && !actual) {
    return <WidgetEmpty message="Heute ist kein Training geplant." />;
  }

  if (size === "S") {
    const primary = planned ?? actual;
    if (!primary) return <WidgetEmpty message="Heute ist kein Training geplant." />;
    const duration = planned?.plannedDurationMin ?? actual?.durationMin;
    return (
      <p className="text-sm text-neutral-700">
        {sportLabel(primary.sport)}
        {duration ? ` · ${duration} min` : ""}
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {planned && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Geplant
          </p>
          <p className="font-medium text-neutral-900">
            {sportLabel(planned.sport)} · {planned.title}
          </p>
          <p className="text-neutral-500">
            {planned.plannedDurationMin} min
            {planned.rpe ? ` · RPE ${planned.rpe}` : ""} ·{" "}
            {STATUS_LABEL[planned.status] ?? planned.status}
          </p>
          {size === "L" && planned.description && (
            <p className="mt-1 text-xs text-neutral-500">{planned.description}</p>
          )}
        </div>
      )}
      {actual && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Absolviert
          </p>
          <p className="font-medium text-neutral-900">{sportLabel(actual.sport)}</p>
          <p className="text-neutral-500">
            {actual.durationMin ? `${actual.durationMin} min` : "—"}
            {actual.distanceKm ? ` · ${actual.distanceKm} km` : ""}
            {size === "L" && actual.load ? ` · Last ${actual.load}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
