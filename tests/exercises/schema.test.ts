import { describe, it, expect } from "vitest";
import {
  exerciseDefinitionSchema,
  segmentExerciseSchema,
  type ExerciseDefinition,
} from "@/domain/exercises/schema";
import {
  builtinExercises,
  builtinExerciseIds,
  getBuiltinExercise,
  __loadLibraryForTest,
} from "@/domain/exercises/library";
import birdDog from "../fixtures/exercises/example-custom-exercise.json";

/** Tiefe Kopie einer Bibliotheksübung als Ausgangspunkt für Negativfälle. */
function sample(id = "dead-bug"): ExerciseDefinition {
  return structuredClone(getBuiltinExercise(id)!) as ExerciseDefinition;
}

function issues(def: unknown): string[] {
  const r = exerciseDefinitionSchema.safeParse(def);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

describe("Übungsbibliothek", () => {
  it("enthält 20 gültige Übungen mit eindeutigen IDs", () => {
    expect(builtinExercises).toHaveLength(20);
    expect(builtinExerciseIds.size).toBe(20);
    for (const e of builtinExercises) {
      expect(issues(e), e.id).toEqual([]);
    }
  });

  it("beschreibt jeden markierten Muskelschlüssel in muscles[]", () => {
    for (const e of builtinExercises) {
      const declared = new Set(e.muscles.map((m) => m.key));
      for (const p of [e.start, e.end]) {
        const used = [
          ...p.torsoMuscles,
          ...p.farLimbs.flatMap((l) => l.muscles),
          ...p.nearLimbs.flatMap((l) => l.muscles),
        ];
        for (const k of used) expect(declared.has(k), `${e.id}: ${k}`).toBe(true);
      }
    }
  });

  it("liefert unbekannte IDs als null", () => {
    expect(getBuiltinExercise("gibt-es-nicht")).toBeNull();
    expect(getBuiltinExercise("plank")?.title).toBe("Plank");
  });

  it("wirft beim Laden kaputter Daten eine Exception mit ID und Pfad", () => {
    const broken = sample();
    broken.title = "";
    expect(() => __loadLibraryForTest([broken])).toThrow(/"dead-bug".*title/);
    expect(() => __loadLibraryForTest([sample(), sample()])).toThrow(/doppelt/);
  });

  it("akzeptiert die Beispiel-Übung Bird Dog", () => {
    expect(issues(birdDog)).toEqual([]);
  });
});

describe("Übungsschema – Negativfälle", () => {
  it("lehnt IDs mit Großbuchstaben ab", () => {
    const d = sample();
    d.id = "Dead-Bug";
    expect(issues(d).join()).toMatch(/^id:/);
  });

  it("lehnt Koordinaten außerhalb des Bereichs ab", () => {
    const d = sample();
    d.start.hip = [500, 50];
    expect(issues(d).join()).toMatch(/start\.hip\.0/);
  });

  it("lehnt NaN und Infinity ab", () => {
    const d = sample();
    d.start.hip = [Number.NaN, 50];
    expect(issues(d).length).toBeGreaterThan(0);
    const e = sample();
    e.tempo.toEndSec = Number.POSITIVE_INFINITY;
    expect(issues(e).length).toBeGreaterThan(0);
  });

  it("lehnt unbekannte Muskeln ab", () => {
    const d = sample() as unknown as { muscles: { key: string }[] };
    d.muscles[0].key = "bizeps";
    expect(issues(d).join()).toMatch(/muscles\.0\.key/);
  });

  it("lehnt nur drei Frames ab", () => {
    const d = sample();
    d.frames = d.frames.slice(0, 3);
    expect(issues(d).join()).toMatch(/frames/);
  });

  it("lehnt ik und points zugleich ab", () => {
    const d = sample();
    const limb = d.start.nearLimbs[0];
    limb.ik = { end: [110, 120], bend: 1 };
    expect(limb.points).toBeDefined();
    expect(issues(d).join()).toMatch(/genau eines von ik oder points/);
  });

  it("lehnt verschiedene Gliedmaßen-Struktur in Start und Ende ab", () => {
    const d = sample();
    d.end.nearLimbs = d.end.nearLimbs.slice(0, d.end.nearLimbs.length - 1);
    expect(issues(d).join()).toMatch(/dieselbe Gliedmaßen-Struktur/);
  });

  it("lehnt einen ungültigen Kettlebell-Index ab", () => {
    const d = sample();
    d.start.kettlebell = { nearLimb: 3, offset: [0, 5] };
    d.start.nearLimbs = d.start.nearLimbs.slice(0, 1);
    d.end.nearLimbs = d.end.nearLimbs.slice(0, 1);
    expect(issues(d).join()).toMatch(/kettlebell\.nearLimb/);
  });

  it("lehnt Steuerzeichen im Titel ab", () => {
    const d = sample();
    d.title = "Dead\u0007Bug";
    expect(issues(d).join()).toMatch(/Steuerzeichen/);
  });

  it("lehnt Zeit 0 im Tempo ab", () => {
    const d = sample();
    d.tempo.holdEndSec = 0;
    expect(issues(d).join()).toMatch(/tempo\.holdEndSec/);
  });

  it("lehnt Arme mit Fuß ab", () => {
    const d = sample();
    const arm = d.start.nearLimbs.find((l) => l.root === "neck")!;
    arm.foot = { angle: 0, toeAngle: null, direction: 1, flip: false };
    expect(issues(d).join()).toMatch(/Arme haben keinen Fuß/);
  });

  it("lehnt Muskeln ab, die an der Pose markiert, aber nicht beschrieben sind", () => {
    const d = sample();
    d.start.torsoMuscles = ["chest"];
    expect(issues(d).join()).toMatch(/"chest"/);
  });

  it("verlangt fault und faultCaption gemeinsam", () => {
    const d = sample("plank");
    expect(d.fault).not.toBeNull();
    d.faultCaption = null;
    expect(issues(d).join()).toMatch(/faultCaption/);
  });

  it("verwirft unbekannte Felder (kein Roh-SVG durchreichbar)", () => {
    const d = { ...sample(), svg: "<script>alert(1)</script>" };
    const r = exerciseDefinitionSchema.parse(d);
    expect("svg" in r).toBe(false);
  });
});

describe("segmentExerciseSchema", () => {
  it("füllt Standardwerte", () => {
    const r = segmentExerciseSchema.parse({ id: "plank", sets: 3, holdSec: 30 });
    expect(r).toEqual({
      id: "plank",
      sets: 3,
      reps: null,
      holdSec: 30,
      restSec: null,
      perSide: false,
      loadKg: null,
      note: null,
    });
  });

  it("verlangt reps oder holdSec", () => {
    expect(segmentExerciseSchema.safeParse({ id: "plank", sets: 3 }).success).toBe(false);
  });

  it("begrenzt Sätze", () => {
    expect(segmentExerciseSchema.safeParse({ id: "plank", sets: 0, reps: 5 }).success).toBe(false);
    expect(segmentExerciseSchema.safeParse({ id: "plank", sets: 21, reps: 5 }).success).toBe(false);
  });
});
