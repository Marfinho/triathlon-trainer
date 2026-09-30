"use client";

import { sportColor, sportLabel } from "@/components/dashboard/Card";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./WidgetStates";

export function SeasonStats({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const { seasonStats } = data.analysis;
  if (seasonStats.totalSessions === 0) {
    return <WidgetEmpty message="Noch keine Aktivitäten erfasst." />;
  }

  if (size === "S") {
    return (
      <p className="text-sm text-neutral-700">
        {seasonStats.totalSessions} Einheiten · {seasonStats.totalHours.toFixed(0)} h
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
        <div>
          <p className="text-base font-semibold text-neutral-900">{seasonStats.totalSessions}</p>
          <p className="text-neutral-400">Einheiten</p>
        </div>
        <div>
          <p className="text-base font-semibold text-neutral-900">
            {seasonStats.totalHours.toFixed(1)}
          </p>
          <p className="text-neutral-400">Stunden</p>
        </div>
        <div>
          <p className="text-base font-semibold text-neutral-900">{seasonStats.totalKm}</p>
          <p className="text-neutral-400">km</p>
        </div>
        <div>
          <p className="text-base font-semibold text-neutral-900">
            {seasonStats.currentStreakDays}
          </p>
          <p className="text-neutral-400">Streak (d)</p>
        </div>
      </div>
      {size === "L" && seasonStats.bySport.length > 0 && (
        <div className="space-y-1.5 border-t border-neutral-100 pt-2">
          {seasonStats.bySport.map((s) => (
            <div key={s.sport} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: sportColor(s.sport) }}
              />
              <span className="flex-1 text-neutral-600">{sportLabel(s.sport)}</span>
              <span className="text-xs text-neutral-400">{s.sessions}×</span>
              <span className="font-medium text-neutral-900">
                {(s.totalMin / 60).toFixed(1)} h
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
