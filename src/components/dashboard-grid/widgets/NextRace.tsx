"use client";

import { daysUntilRace, describeCountdown, trainingPhase } from "@/domain/training/races";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./WidgetStates";

const PRIORITY_LABEL: Record<string, string> = {
  A: "A-Rennen",
  B: "B-Rennen",
  C: "C-Rennen",
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function NextRace({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const { nextRace } = data.races;
  if (!nextRace) {
    return <WidgetEmpty message="Kein anstehendes Rennen geplant." />;
  }

  const days = daysUntilRace(nextRace.date, new Date(data.today.dateIso));
  const countdown = describeCountdown(days);

  if (size === "S") {
    return (
      <p className="text-sm text-neutral-700">
        {nextRace.name} <span className="text-neutral-400">({countdown})</span>
      </p>
    );
  }

  const phase = trainingPhase(days);

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-neutral-900">{nextRace.name}</p>
        <p className="text-xs text-neutral-500">
          {fmtDate(nextRace.date)} · {countdown}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {nextRace.priority && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
            {PRIORITY_LABEL[nextRace.priority] ?? nextRace.priority}
          </span>
        )}
        {nextRace.distance && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
            {nextRace.distance}
          </span>
        )}
        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
          {phase.label}
        </span>
      </div>
      {size === "L" && (
        <div className="space-y-1 text-xs text-neutral-500">
          {nextRace.locationName && <p>{nextRace.locationName}</p>}
          {nextRace.notes && <p className="text-neutral-600">{nextRace.notes}</p>}
        </div>
      )}
    </div>
  );
}
