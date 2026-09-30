import { describe, it, expect } from "vitest";
import { validateLocalhubPlan } from "@/domain/plan-import/validateLocalhubPlan";
import {
  inspectRawExerciseDefinitions,
  summarizePlanExercises,
} from "@/domain/plan-import/buildPlanPreview";
import { builtinExerciseIds } from "@/domain/exercises/library";
import { validateExerciseReferences } from "@/domain/plan-import/validateExercises";
import examplePlan from "../fixtures/exercises/example-plan-with-exercises.json";
import birdDog from "../fixtures/exercises/example-custom-exercise.json";

type RawPlan = {
  schemaVersion: string;
  entries: {
    date: string;
    sport: string;
    plannedDurationMin: number;
    segments: Record<string, unknown>[];
  }[];
  exerciseDefinitions?: Record<string, unknown>[];
  [key: string]: unknown;
};

/**
 * Beispielplan mit plausibler Dauer für Katze-Kuh: Im Original stehen 10
 * Wiederholungen (≈ 66 s) in einem 240-s-Aufwärmsegment, was die
 * (nicht blockierende) Dauerwarnung auslöst – siehe eigener Test.
 */
function plan(): RawPlan {
  const p = structuredClone(examplePlan) as unknown as RawPlan;
  (p.entries[0].segments[0].exercise as { sets: number }).sets = 3;
  return p;
}

function codes(raw: unknown, opts?: Parameters<typeof validateLocalhubPlan>[1]) {
  const r = validateLocalhubPlan(raw, opts);
  return { errors: r.errors.map((e) => e.code), warnings: r.warnings.map((w) => w.code), r };
}

/** Minimaler 1.0-Plan ohne Übungen (Regression). */
function legacyPlan() {
  return {
    schemaVersion: "1.0",
    type: "localhub_plan",
    planStart: "2026-06-15",
    planDays: 1,
    planEnd: "2026-06-15",
    entries: [
      {
        date: "2026-06-15",
        sport: "run",
        title: "Dauerlauf",
        plannedDurationMin: 60,
        segments: [
          { type: "warmup", durationSec: 600 },
          { type: "steady", durationSec: 3000 },
        ],
      },
    ],
  };
}

describe("Plan 1.1 mit Übungen", () => {
  it("akzeptiert den Beispielplan", () => {
    const { errors, warnings, r } = codes(plan());
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(r.valid).toBe(true);
    const seg = r.plan!.entries[0].segments[1];
    expect(seg.exercise).toMatchObject({ id: "clamshell", sets: 2, reps: 15, perSide: true });
  });

  it("der unveränderte Beispielplan ist gültig, warnt nur bei Katze-Kuh", () => {
    const { errors, r } = codes(examplePlan);
    expect(errors).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].code).toBe("EXERCISE_DURATION_IMPLAUSIBLE");
    expect(r.warnings[0].message).toContain("cat-cow");
  });

  it("fasst die Übungen für die Vorschau zusammen", () => {
    const r = validateLocalhubPlan(plan());
    const summary = summarizePlanExercises(r.plan!);
    expect(summary.used).toEqual([
      "cat-cow",
      "clamshell",
      "dead-bug",
      "copenhagen-plank",
      "bird-dog",
      "thoracic-rotation",
    ]);
    expect(summary.segmentCount).toBe(6);
    expect(summary.custom).toEqual([{ id: "bird-dog", title: "Bird Dog", valid: true }]);
  });

  it("lehnt unbekannte IDs ab und nennt die gültigen", () => {
    const p = plan();
    (p.entries[0].segments[1].exercise as { id: string }).id = "muschel";
    const { errors, r } = codes(p);
    expect(errors).toEqual(["EXERCISE_UNKNOWN"]);
    expect(r.errors[0].message).toContain("muschel");
    for (const id of builtinExerciseIds) expect(r.errors[0].message).toContain(id);
    expect(r.errors[0].path).toBe("entries[0].segments[1].exercise.id");
  });

  it("kennt bereits gespeicherte eigene Übungen des Nutzers", () => {
    const p = plan();
    delete p.exerciseDefinitions;
    expect(codes(p).errors).toEqual(["EXERCISE_UNKNOWN"]);
    const withStored = codes(p, {
      existingCustomExercises: [{ exerciseId: "bird-dog", definitionJson: birdDog }],
    });
    expect(withStored.errors).toEqual([]);
  });

  it("lehnt Kollisionen mit eingebauten IDs ab", () => {
    const p = plan();
    p.exerciseDefinitions = [{ ...birdDog, id: "plank" }, birdDog];
    expect(codes(p).errors).toContain("EXERCISE_ID_COLLISION");
  });

  it("lehnt doppelte IDs ab", () => {
    const p = plan();
    p.exerciseDefinitions = [birdDog, birdDog];
    expect(codes(p).errors).toEqual(["EXERCISE_ID_DUPLICATE"]);
  });

  it("verlangt schemaVersion 1.1 für exerciseDefinitions", () => {
    const p = plan();
    p.schemaVersion = "1.0";
    expect(codes(p).errors).toEqual(["EXERCISE_DEFINITIONS_NEED_1_1"]);
  });

  it("erlaubt Übungssegmente auch unter 1.0 (ohne eigene Definitionen)", () => {
    const p = plan();
    p.schemaVersion = "1.0";
    p.entries[0].segments = p.entries[0].segments.filter(
      (s) => (s.exercise as { id: string } | null)?.id !== "bird-dog",
    );
    p.entries[0].plannedDurationMin = 28;
    delete p.exerciseDefinitions;
    expect(codes(p).errors).toEqual([]);
  });

  it("begrenzt die Größe der Definitionen (200 KB, in Bytes)", () => {
    const parsed = validateLocalhubPlan(plan()).plan!;
    // Umlaute zählen doppelt (UTF-8): 20 × ~10 KB Text ergeben > 200 KB.
    const big = Array.from({ length: 20 }, (_, i) => ({
      ...parsed.exerciseDefinitions![0],
      id: `bird-dog-${i}`,
      why: "ä".repeat(5000),
    }));
    const result = validateExerciseReferences({ ...parsed, exerciseDefinitions: big });
    expect(result.errors.map((e) => e.code)).toContain("EXERCISE_DEFINITIONS_TOO_LARGE");
    const small = validateExerciseReferences(parsed);
    expect(small.errors).toEqual([]);
  });

  it("lehnt mehr als 20 Definitionen strukturell ab", () => {
    const p = plan();
    p.exerciseDefinitions = Array.from({ length: 21 }, (_, i) => ({ ...birdDog, id: `bd-${i}` }));
    expect(codes(p).errors).toContain("SCHEMA_INVALID");
  });

  it("warnt bei unbenutzten Definitionen", () => {
    const p = plan();
    p.exerciseDefinitions = [birdDog, { ...birdDog, id: "bird-dog-2" }];
    const { errors, warnings } = codes(p);
    expect(errors).toEqual([]);
    expect(warnings).toEqual(["EXERCISE_DEFINITION_UNUSED"]);
  });

  it("warnt bei unplausibler Übungsdauer, blockiert aber nicht", () => {
    const p = plan();
    (p.entries[0].segments[1].exercise as { sets: number }).sets = 12;
    const { errors, warnings } = codes(p);
    expect(errors).toEqual([]);
    expect(warnings).toEqual(["EXERCISE_DURATION_IMPLAUSIBLE"]);
  });

  it("warnt, wenn eine gespeicherte Definition überschrieben würde", () => {
    const stored = { ...birdDog, title: "Bird Dog alt" };
    const { warnings } = codes(plan(), {
      existingCustomExercises: [{ exerciseId: "bird-dog", definitionJson: stored }],
    });
    expect(warnings).toEqual(["EXERCISE_DEFINITION_UPDATED"]);
    const same = codes(plan(), {
      existingCustomExercises: [{ exerciseId: "bird-dog", definitionJson: birdDog }],
    });
    expect(same.warnings).toEqual([]);
  });

  it("blockiert beim Nutzer-Limit von 200 eigenen Übungen", () => {
    const stored = Array.from({ length: 200 }, (_, i) => ({
      exerciseId: `custom-${i}`,
      definitionJson: {},
    }));
    expect(codes(plan(), { existingCustomExercises: stored }).errors).toEqual([
      "CUSTOM_EXERCISE_LIMIT",
    ]);
  });

  it("prüft die Segmentsumme unverändert auch für Übungssegmente", () => {
    const p = plan();
    p.entries[0].plannedDurationMin = 60;
    expect(codes(p).errors).toEqual(["SEGMENT_DURATION_MISMATCH"]);
  });

  it("lehnt ungültige eigene Definitionen strukturell ab", () => {
    const p = plan();
    p.exerciseDefinitions = [{ ...birdDog, frames: [] }];
    expect(codes(p).errors).toContain("SCHEMA_INVALID");
  });
});

describe("Regression 1.0", () => {
  it("ein 1.0-Plan ohne Übungen bleibt gültig und bekommt exercise = null", () => {
    const r = validateLocalhubPlan(legacyPlan());
    expect(r.valid).toBe(true);
    expect(r.warnings).toEqual([]);
    expect(r.plan!.entries[0].segments.every((s) => s.exercise === null)).toBe(true);
    expect(r.plan!.exerciseDefinitions).toBeUndefined();
  });
});

describe("inspectRawExerciseDefinitions", () => {
  it("prüft jede Definition einzeln, auch wenn der Plan ungültig ist", () => {
    const checks = inspectRawExerciseDefinitions({
      exerciseDefinitions: [birdDog, { ...birdDog, id: "Kaputt" }, { ...birdDog, id: "plank" }, 42],
    });
    expect(checks.map((c) => c.valid)).toEqual([true, false, false, false]);
    expect(checks[1].error).toMatch(/^id:/);
    expect(checks[2].error).toMatch(/EXERCISE_ID_COLLISION/);
    expect(checks[0].definition?.id).toBe("bird-dog");
  });

  it("liefert ein leeres Ergebnis ohne Definitionen", () => {
    expect(inspectRawExerciseDefinitions({})).toEqual([]);
    expect(inspectRawExerciseDefinitions(null)).toEqual([]);
  });
});
