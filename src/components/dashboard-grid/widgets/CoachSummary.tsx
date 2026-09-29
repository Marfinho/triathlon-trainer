"use client";

import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetError, WidgetSkeleton } from "./WidgetStates";

const LEVEL_STYLE: Record<string, string> = {
  go_hard: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  steady: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  easy: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  recover: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300",
};

export function CoachSummary({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const { coachRecommendation } = data.analysis;
  const cls = LEVEL_STYLE[coachRecommendation.level] ?? LEVEL_STYLE.steady;

  if (size === "S") {
    return (
      <p className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
        {coachRecommendation.headline}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
        {coachRecommendation.headline}
      </p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{coachRecommendation.detail}</p>
      {size === "L" && (
        <a
          href="/coach"
          className="inline-flex h-11 items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
        >
          Zum Coach-Export →
        </a>
      )}
    </div>
  );
}
