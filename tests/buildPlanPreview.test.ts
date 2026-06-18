import { describe, it, expect } from "vitest";
import { buildPlanPreview } from "@/domain/plan-import/buildPlanPreview";
import type { LocalhubPlan, PlanEntry } from "@/domain/schemas";
import type { ExistingWorkoutRef } from "@/domain/plan-import/validateLocalhubPlan";

function entry(overrides: Partial<PlanEntry>): PlanEntry {
  return {
    date: "2026-06-15",
    sport: "run",
    title: "Lauf",
    plannedDurationMin: 60,
    plannedDistanceM: null,
    rpe: null,
    description: null,
    segments: [],
    ...overrides,
  };
}

function plan(entries: PlanEntry[]): LocalhubPlan {
  return {
    schemaVersion: "1.0",
    type: "localhub_plan",
    planName: "Testwoche",
    generatedAt: "2026-06-14T10:00:00Z",
    planStart: "2026-06-15",
    planDays: entries.length,
    planEnd: "2026-06-17",
    entries,
  };
}

describe("buildPlanPreview", () => {
  it("markiert Tage ohne existierendes Workout als create", () => {
    const days = buildPlanPreview(plan([entry({ date: "2026-06-15" })]), []);
    expect(days).toEqual([
      expect.objectContaining({ date: "2026-06-15", action: "create", existing: null }),
    ]);
  });

  it("markiert Ruhetage als rest, unabhängig von existierenden Workouts", () => {
    const existing: ExistingWorkoutRef[] = [
      { id: "w1", date: "2026-06-15", status: "planned", title: "Alt" },
    ];
    const days = buildPlanPreview(
      plan([entry({ date: "2026-06-15", sport: "rest", plannedDurationMin: 0, segments: [] })]),
      existing,
    );
    expect(days[0].action).toBe("rest");
  });

  it("markiert offene existierende Workouts als replace", () => {
    const existing: ExistingWorkoutRef[] = [
      { id: "w1", date: "2026-06-15", status: "planned", title: "Alt" },
    ];
    const days = buildPlanPreview(plan([entry({ date: "2026-06-15" })]), existing);
    expect(days[0].action).toBe("replace");
    expect(days[0].existing?.id).toBe("w1");
  });

  it("markiert completed existierende Workouts als protected", () => {
    const existing: ExistingWorkoutRef[] = [
      { id: "w1", date: "2026-06-15", status: "completed", title: "Alt" },
    ];
    const days = buildPlanPreview(plan([entry({ date: "2026-06-15" })]), existing);
    expect(days[0].action).toBe("protected");
  });

  it("sortiert Tage chronologisch", () => {
    const days = buildPlanPreview(
      plan([entry({ date: "2026-06-17" }), entry({ date: "2026-06-15" })]),
      [],
    );
    expect(days.map((d) => d.date)).toEqual(["2026-06-15", "2026-06-17"]);
  });
});
