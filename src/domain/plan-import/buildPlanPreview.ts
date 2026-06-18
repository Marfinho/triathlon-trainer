import type { LocalhubPlan, PlanEntry } from "@/domain/schemas";
import type { ExistingWorkoutRef } from "./validateLocalhubPlan";
import { formatIsoDate } from "@/domain/training/dates";

/**
 * Tag-für-Tag-Diff zwischen einem `localhub_plan` und den bereits in der DB
 * vorhandenen geplanten Workouts – Grundlage für eine Vorschau/Diff-UI vor
 * dem eigentlichen Import.
 */

export type PlanPreviewAction = "create" | "replace" | "protected" | "rest";

export interface PlanPreviewDay {
  date: string;
  entry: PlanEntry;
  existing: ExistingWorkoutRef | null;
  action: PlanPreviewAction;
}

function toIsoDate(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : formatIsoDate(value);
}

export function buildPlanPreview(
  plan: LocalhubPlan,
  existingWorkouts: ExistingWorkoutRef[],
): PlanPreviewDay[] {
  const existingByDate = new Map<string, ExistingWorkoutRef>();
  for (const w of existingWorkouts) {
    existingByDate.set(toIsoDate(w.date), w);
  }

  return plan.entries
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((entry) => {
      const existing = existingByDate.get(entry.date) ?? null;
      let action: PlanPreviewAction;
      if (entry.sport === "rest") {
        action = "rest";
      } else if (existing?.status === "completed") {
        action = "protected";
      } else if (existing) {
        action = "replace";
      } else {
        action = "create";
      }
      return { date: entry.date, entry, existing, action };
    });
}
