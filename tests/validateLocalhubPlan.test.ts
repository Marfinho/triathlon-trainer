import { describe, it, expect } from "vitest";
import {
  validateLocalhubPlan,
  type ExistingWorkoutRef,
} from "@/domain/plan-import/validateLocalhubPlan";
import type { LocalhubPlan } from "@/domain/schemas";

/** Baut einen gültigen 3-Tage-Plan (Run, Rest, Swim). */
function validPlan(): LocalhubPlan {
  return {
    schemaVersion: "1.0",
    type: "localhub_plan",
    planName: "Testwoche",
    generatedAt: "2026-06-14T10:00:00Z",
    planStart: "2026-06-15",
    planDays: 3,
    planEnd: "2026-06-17",
    entries: [
      {
        date: "2026-06-15",
        sport: "run",
        title: "Dauerlauf",
        plannedDurationMin: 60,
        plannedDistanceM: 10000,
        rpe: 3,
        description: "GA1",
        segments: [
          {
            type: "warmup",
            durationSec: 600,
            distanceM: null,
            intensity: "easy",
            targetType: "rpe",
            targetValue: 2,
            targetValueTo: null,
            cadenceNote: null,
            rpeTarget: 2,
            description: "Einlaufen",
          },
          {
            type: "steady",
            durationSec: 3000,
            distanceM: null,
            intensity: "endurance",
            targetType: "rpe",
            targetValue: 3,
            targetValueTo: null,
            cadenceNote: null,
            rpeTarget: 3,
            description: "Hauptteil",
          },
        ],
      },
      {
        date: "2026-06-16",
        sport: "rest",
        title: "Ruhetag",
        plannedDurationMin: 0,
        plannedDistanceM: null,
        rpe: null,
        description: null,
        segments: [],
      },
      {
        date: "2026-06-17",
        sport: "swim",
        title: "Techniktraining",
        plannedDurationMin: 45,
        plannedDistanceM: 2000,
        rpe: 2,
        description: null,
        segments: [
          {
            type: "warmup",
            durationSec: 600,
            distanceM: 400,
            intensity: "easy",
            targetType: "rpe",
            targetValue: 2,
            targetValueTo: null,
            cadenceNote: null,
            rpeTarget: 2,
            description: "Einschwimmen",
          },
          {
            type: "steady",
            durationSec: 1800,
            distanceM: 1200,
            intensity: "drill",
            targetType: "rpe",
            targetValue: 2,
            targetValueTo: null,
            cadenceNote: null,
            rpeTarget: 2,
            description: "Drills",
          },
          {
            type: "cooldown",
            durationSec: 300,
            distanceM: 400,
            intensity: "easy",
            targetType: "rpe",
            targetValue: 1,
            targetValueTo: null,
            cadenceNote: null,
            rpeTarget: 1,
            description: "Ausschwimmen",
          },
        ],
      },
    ],
  };
}

function codes(plan: unknown): string[] {
  return validateLocalhubPlan(plan).errors.map((e) => e.code);
}

describe("validateLocalhubPlan", () => {
  it("akzeptiert einen gültigen Plan", () => {
    const result = validateLocalhubPlan(validPlan());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.plan).toBeDefined();
    expect(result.meta?.dates).toHaveLength(3);
  });

  it("lehnt falschen type ab", () => {
    const plan = { ...validPlan(), type: "something_else" };
    const result = validateLocalhubPlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "SCHEMA_INVALID")).toBe(true);
  });

  it("lehnt ungültige Sportart ab", () => {
    const plan = validPlan();
    // @ts-expect-error absichtlich ungültig
    plan.entries[0].sport = "quidditch";
    expect(codes(plan)).toContain("SCHEMA_INVALID");
  });

  it("erkennt inkonsistentes planEnd", () => {
    const plan = { ...validPlan(), planEnd: "2026-06-20" };
    expect(codes(plan)).toContain("PLAN_END_INCONSISTENT");
  });

  it("erkennt nicht abgedeckte Tage", () => {
    const plan = validPlan();
    plan.entries = plan.entries.filter((e) => e.date !== "2026-06-16");
    expect(codes(plan)).toContain("DAY_NOT_COVERED");
  });

  it("erkennt Einträge außerhalb des Zeitraums", () => {
    const plan = validPlan();
    plan.entries[1].date = "2026-07-01";
    const c = codes(plan);
    expect(c).toContain("ENTRY_OUT_OF_RANGE");
    expect(c).toContain("DAY_NOT_COVERED");
  });

  it("erzwingt Ruhetag-Regeln: Dauer 0", () => {
    const plan = validPlan();
    plan.entries[1].plannedDurationMin = 30;
    expect(codes(plan)).toContain("REST_DAY_NONZERO_DURATION");
  });

  it("erzwingt Ruhetag-Regeln: keine Segmente", () => {
    const plan = validPlan();
    plan.entries[1].segments = [
      {
        type: "steady",
        durationSec: 0,
        distanceM: null,
        intensity: null,
        targetType: null,
        targetValue: null,
        targetValueTo: null,
        cadenceNote: null,
        rpeTarget: null,
        description: null,
      },
    ];
    expect(codes(plan)).toContain("REST_DAY_HAS_SEGMENTS");
  });

  it("erzwingt Trainingstag mit Dauer > 0", () => {
    const plan = validPlan();
    plan.entries[0].plannedDurationMin = 0;
    expect(codes(plan)).toContain("TRAINING_DAY_ZERO_DURATION");
  });

  it("erkennt unplausible Segmentsumme", () => {
    const plan = validPlan();
    plan.entries[0].plannedDurationMin = 120; // Segmente summieren 60 min
    expect(codes(plan)).toContain("SEGMENT_DURATION_MISMATCH");
  });

  it("toleriert kleine Abweichungen der Segmentsumme", () => {
    const plan = validPlan();
    plan.entries[0].plannedDurationMin = 62; // innerhalb Toleranz
    expect(codes(plan)).not.toContain("SEGMENT_DURATION_MISMATCH");
  });

  it("erkennt abweichende Schwimmdistanz", () => {
    const plan = validPlan();
    plan.entries[2].plannedDistanceM = 3000; // Segmente summieren 2000
    expect(codes(plan)).toContain("SWIM_DISTANCE_MISMATCH");
  });

  it("toleriert Legacy-snake_case-Segmente", () => {
    const plan = validPlan();
    // @ts-expect-error Legacy-Format absichtlich
    plan.entries[0].segments = [
      {
        type: "warmup",
        duration_sec: 600,
        distance_m: null,
        intensity: "easy",
        target_type: "rpe",
        target_value: 2,
        rpe_target: 2,
        description: "Einlaufen",
      },
      {
        type: "steady",
        duration_sec: 3000,
        intensity: "endurance",
        target_type: "rpe",
        target_value: 3,
        rpe_target: 3,
        description: "Hauptteil",
      },
    ];
    const result = validateLocalhubPlan(plan);
    expect(result.valid).toBe(true);
  });

  it("ermittelt geschützte und ersetzbare Workouts im Zeitraum", () => {
    const existing: ExistingWorkoutRef[] = [
      { id: "a", date: "2026-06-15", status: "completed", title: "Done" },
      { id: "b", date: "2026-06-16", status: "planned", title: "Open" },
      { id: "c", date: "2026-06-17", status: "synced", title: "Synced" },
      { id: "d", date: "2026-07-01", status: "planned", title: "Outside" },
      { id: "e", date: "2026-06-16", status: "cancelled", title: "Cancelled" },
    ];
    const result = validateLocalhubPlan(validPlan(), {
      existingWorkouts: existing,
    });
    expect(result.valid).toBe(true);
    expect(result.protectedActivities.map((w) => w.id)).toEqual(["a"]);
    expect(result.replaceableWorkouts.map((w) => w.id).sort()).toEqual([
      "b",
      "c",
    ]);
  });

  it("erkennt Abweichung zum letzten Export", () => {
    const result = validateLocalhubPlan(validPlan(), {
      expectedExport: { planStart: "2026-06-22", planDays: 7 },
    });
    expect(result.errors.map((e) => e.code)).toContain("EXPORT_MISMATCH");
  });

  it("ändert nichts bei Validierungsfehlern (plan bleibt undefined)", () => {
    const plan = { ...validPlan(), planEnd: "2026-06-30" };
    const result = validateLocalhubPlan(plan);
    expect(result.valid).toBe(false);
    expect(result.plan).toBeUndefined();
  });
});
