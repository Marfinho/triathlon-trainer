import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "../helpers/testDb";
import { getLibraryExercise } from "@/domain/exercises/library";
import { checkSingleExercise, saveSingleExercise } from "@/domain/exercises/singleExercise";
import { buildNewExercisePrompt, WISH_PLACEHOLDER } from "@/domain/exercises/newExercisePrompt";
import { listValidCustomExercises, findExerciseForUser } from "@/domain/exercises/resolve";
import { isExercise3d } from "@/domain/exercises/any";
import { validateLocalhubPlan } from "@/domain/plan-import/validateLocalhubPlan";
import type { Exercise3dDefinition } from "@/domain/exercises/body3d";
import examplePlan from "../fixtures/exercises/example-plan-with-exercises.json";

/** Neue 3D-Übung: die Glute Bridge mit eigener ID (gültig, keine Kollision). */
function hipLift(): Exercise3dDefinition {
  const d = structuredClone(getLibraryExercise("glute-bridge")) as Exercise3dDefinition;
  d.id = "hip-lift-3d";
  d.title = "Hüftheben";
  return d;
}

describe("checkSingleExercise", () => {
  it("akzeptiert eine gültige 3D-Übung, auch als JSON-String", () => {
    expect(checkSingleExercise(hipLift()).errors).toEqual([]);
    const r = checkSingleExercise(JSON.stringify(hipLift()));
    expect(r.errors).toEqual([]);
    expect(r.definition && isExercise3d(r.definition)).toBe(true);
  });

  it("nimmt die eine Definition aus einem eingefügten Plan", () => {
    expect(checkSingleExercise({ exerciseDefinitions: [hipLift()] }).definition?.id).toBe("hip-lift-3d");
    expect(checkSingleExercise({ exerciseDefinitions: [hipLift(), hipLift()] }).errors[0].code).toBe("EXERCISE_SINGLE_EXPECTED");
  });

  it("meldet kaputtes JSON, Schemafehler mit Pfad, ID-Kollision und Posenfehler", () => {
    expect(checkSingleExercise("{kein json").errors[0].code).toBe("INVALID_JSON");
    const bad = hipLift() as unknown as Record<string, unknown>;
    bad.view = "diagonal";
    const schema = checkSingleExercise(bad);
    expect(schema.errors[0]).toMatchObject({ code: "EXERCISE_SCHEMA", path: "view" });
    expect(checkSingleExercise(getLibraryExercise("glute-bridge")).errors.map((e) => e.code)).toContain("EXERCISE_ID_COLLISION");
    const pose = hipLift();
    pose.keyframes[0].joints.elbow_l = { flex: 170 };
    expect(checkSingleExercise(pose).errors.map((e) => e.code)).toContain("EXERCISE_POSE_INVALID");
  });

  it("lehnt zu große Definitionen ab", () => {
    const big = hipLift();
    big.why = "x".repeat(500);
    const huge = { ...big, steps: Array(8).fill("y".repeat(300)), padding: "z".repeat(50_000) };
    expect(checkSingleExercise(huge).errors[0].code).toBe("EXERCISE_DEFINITIONS_TOO_LARGE");
  });
});

describe("buildNewExercisePrompt", () => {
  it("enthält Wunsch, Bauplan, vorhandene IDs und Beispiel", () => {
    const p = buildNewExercisePrompt({ wish: "Wadendehnung an der Wand", existingIds: ["plank", "dead-bug"] });
    expect(p).toContain("MEIN WUNSCH: Wadendehnung an der Wand");
    expect(p).toContain("3D-FORMAT");
    expect(p).toContain("plank, dead-bug");
    expect(p).toContain('"format":"3d"');
  });

  it("Platzhalter lässt sich im Client ersetzen", () => {
    const p = buildNewExercisePrompt({ wish: WISH_PLACEHOLDER, existingIds: [] });
    expect(p.split(WISH_PLACEHOLDER)).toHaveLength(2);
  });
});

describe("Plan mit 3D-Übung", () => {
  type RawPlan = { exerciseDefinitions: Record<string, unknown>[]; entries: { segments: { exercise?: { id: string } }[] }[] };
  function planWith(def: Exercise3dDefinition): RawPlan {
    const p = structuredClone(examplePlan) as unknown as RawPlan;
    p.exerciseDefinitions = [def as unknown as Record<string, unknown>];
    for (const e of p.entries) for (const s of e.segments) if (s.exercise?.id === "bird-dog") s.exercise.id = def.id;
    return p;
  }

  it("akzeptiert eine gültige 3D-Definition", () => {
    const r = validateLocalhubPlan(planWith(hipLift()));
    expect(r.errors).toEqual([]);
  });

  it("Posenfehler blockieren den Import mit Pfad", () => {
    const def = hipLift();
    def.keyframes[1].joints.knee_l = { flex: 170 };
    const r = validateLocalhubPlan(planWith(def));
    const err = r.errors.find((e) => e.code === "EXERCISE_POSE_INVALID");
    expect(err?.path).toBe("exerciseDefinitions[0].keyframes[1].joints.knee_l.flex");
  });
});

describe("saveSingleExercise (DB)", () => {
  let db: PrismaClient;
  let cleanup: () => Promise<void>;
  let userId: string;

  beforeAll(() => {
    const ctx = createTestDb();
    db = ctx.db;
    cleanup = ctx.cleanup;
  });
  afterAll(async () => {
    await cleanup();
  });
  beforeEach(async () => {
    userId = await resetDb(db);
  });

  it("speichert nur für den Nutzer, überschreibt die eigene und ist danach auflösbar", async () => {
    const first = await saveSingleExercise(userId, hipLift(), db);
    expect(first).toMatchObject({ ok: true, change: "created" });
    const again = hipLift();
    again.title = "Hüftheben neu";
    expect(await saveSingleExercise(userId, again, db)).toMatchObject({ ok: true, change: "updated" });

    const mine = await listValidCustomExercises(userId, db);
    expect(mine.map((d) => d.title)).toEqual(["Hüftheben neu"]);
    expect((await findExerciseForUser(userId, "hip-lift-3d", db))?.custom).toBe(true);

    const other = await db.user.create({ data: { email: `x-${Date.now()}@example.com` } });
    expect(await listValidCustomExercises(other.id, db)).toEqual([]);
    expect(await findExerciseForUser(other.id, "hip-lift-3d", db)).toBeNull();
  });

  it("speichert nichts bei Fehlern", async () => {
    const bad = hipLift();
    bad.keyframes[0].joints.knee_r = { flex: 170 };
    const r = await saveSingleExercise(userId, bad, db);
    expect(r.ok).toBe(false);
    expect(await db.customExercise.count({ where: { userId } })).toBe(0);
  });
});
