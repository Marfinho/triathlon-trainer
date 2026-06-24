"use client";

import { sportColor, sportLabel } from "@/components/dashboard/Card";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import type { DashboardPlannedWorkout } from "../dashboardData";
import { WidgetError, WidgetSkeleton } from "./WidgetStates";

const WEEKDAY_LABEL = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function dayIndex(dateIso: string, weekStart: string): number {
  const diff = (Date.parse(dateIso) - Date.parse(weekStart)) / 86_400_000;
  return Math.round(diff);
}

export function WeekCalendar({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const { weekStart, planned } = data.week;
  const days: (DashboardPlannedWorkout | null)[] = Array.from({ length: 7 }, () => null);
  for (const p of planned) {
    const idx = dayIndex(p.date.slice(0, 10), weekStart);
    if (idx >= 0 && idx < 7) days[idx] = p;
  }

  if (size === "S") {
    const count = planned.length;
    return (
      <p className="text-sm text-neutral-700">
        {count} Einheit{count === 1 ? "" : "en"} diese Woche
      </p>
    );
  }

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day, i) => (
        <div
          key={i}
          className="flex flex-col items-center gap-1 rounded-lg bg-neutral-50 py-1.5"
        >
          <span className="text-[10px] font-medium text-neutral-400">{WEEKDAY_LABEL[i]}</span>
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: day ? sportColor(day.sport) : "#e5e5e5" }}
            title={day ? sportLabel(day.sport) : undefined}
          />
          {size === "L" && (
            <span className="text-[9px] text-neutral-500">
              {day ? `${day.plannedDurationMin}'` : "—"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
