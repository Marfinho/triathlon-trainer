import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "../helpers/testDb";
import { importLocalhubPlan } from "@/domain/plan-import/importLocalhubPlan";
import {
  listValidCustomExercises,
  resolveExercisesForWorkout,
} from "@/domain/exercises/resolve";
import { parseIsoDate } from "@/domain/training/dates";
import { buildWorkoutExerciseRows } from "@/domain/exercises/workoutRows";
import examplePlan from "../fixtures/exercises/example-plan-with-exercises.json";
import birdDog from "../fixtures/exercises/example-custom-exercise.json";

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

type RawPlan = typeof examplePlan & { exerciseDefinitions: Record<string, unknown>[] };

function plan(): RawPlan {
  return structuredClone(examplePlan) as RawPlan;
}

async function otherUser(): Promise<string> {
  const u = await db.user.create({ data: { email: `b-${Date.now()}-${Math.random()}@example.com` } });
  return u.id;
}

describe("Import eigener Übungen", () => {
  it("legt CustomExercise und Workouts mit Übungssegmenten an", async () => {
    const result = await importLocalhubPlan(plan(), { db, userId });
    expect(result.success).toBe(true);
    expect(result.preview?.exerciseChanges).toEqual([{ id: "bird-dog", change: "created" }]);
    expect(result.preview?.exercises.custom).toEqual([
      { id: "bird-dog", title: "Bird Dog", valid: true },
    ]);

    const rows = await db.customExercise.findMany({ where: { userId } });
    expect(rows.map((r) => r.exerciseId)).toEqual(["bird-dog"]);

    const workout = await db.plannedWorkout.findFirst({
      where: { userId, sport: "strength" },
    });
    const segments = workout!.segmentsJson as { exercise: { id: string } | null }[];
    expect(segments.map((s) => s.exercise?.id)).toContain("bird-dog");

    const resolved = await resolveExercisesForWorkout(userId, workout!.segmentsJson, db);
    expect(resolved.get("bird-dog")).toMatchObject({ status: "ok", source: "custom" });
    expect(resolved.get("clamshell")).toMatchObject({ status: "ok", source: "builtin" });
  });

  it("überschreibt eine geänderte Definition und warnt", async () => {
    await importLocalhubPlan(plan(), { db, userId });
    const changed = plan();
    changed.exerciseDefinitions[0] = { ...birdDog, title: "Bird Dog (Variante)" };
    const result = await importLocalhubPlan(changed, { db, userId });
    expect(result.success).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain("EXERCISE_DEFINITION_UPDATED");
    expect(result.preview?.exerciseChanges).toEqual([{ id: "bird-dog", change: "updated" }]);
    const row = await db.customExercise.findFirst({ where: { userId, exerciseId: "bird-dog" } });
    expect((row!.definitionJson as { title: string }).title).toBe("Bird Dog (Variante)");
  });

  it("ein identischer Import ist für die Übung ein No-op", async () => {
    await importLocalhubPlan(plan(), { db, userId });
    const before = await db.customExercise.findFirst({ where: { userId } });
    const result = await importLocalhubPlan(plan(), { db, userId });
    expect(result.success).toBe(true);
    expect(result.warnings.map((w) => w.code)).not.toContain("EXERCISE_DEFINITION_UPDATED");
    expect(result.preview?.exerciseChanges).toEqual([{ id: "bird-dog", change: "unchanged" }]);
    const after = await db.customExercise.findFirst({ where: { userId } });
    expect(after!.updatedAt.getTime()).toBe(before!.updatedAt.getTime());
    expect(await db.customExercise.count({ where: { userId } })).toBe(1);
  });

  it("speichert bei einem Fehler im Plan nichts", async () => {
    const broken = plan();
    (broken.entries[0].segments[1].exercise as { id: string }).id = "gibt-es-nicht";
    const result = await importLocalhubPlan(broken, { db, userId });
    expect(result.success).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(["EXERCISE_UNKNOWN"]);
    expect(await db.customExercise.count()).toBe(0);
    expect(await db.plannedWorkout.count()).toBe(0);
    expect(await db.trainingPlanImport.count()).toBe(0);
  });

  it("lehnt Kollisionen ab, ohne etwas zu speichern", async () => {
    const colliding = plan();
    colliding.exerciseDefinitions.push({ ...birdDog, id: "plank" });
    const result = await importLocalhubPlan(colliding, { db, userId });
    expect(result.success).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("EXERCISE_ID_COLLISION");
    expect(await db.customExercise.count()).toBe(0);
  });

  it("Nutzer A sieht nie die Übungen von Nutzer B", async () => {
    const userB = await otherUser();
    await importLocalhubPlan(plan(), { db, userId: userB });
    expect(await listValidCustomExercises(userId, db)).toEqual([]);
    expect((await listValidCustomExercises(userB, db)).map((d) => d.id)).toEqual(["bird-dog"]);

    // Ein Plan von A, der B's Übung nur referenziert, ist für A unbekannt.
    const refOnly = plan() as Partial<RawPlan>;
    delete refOnly.exerciseDefinitions;
    const result = await importLocalhubPlan(refOnly, { db, userId });
    expect(result.success).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(["EXERCISE_UNKNOWN"]);

    const segments = [{ exercise: { id: "bird-dog" } }];
    expect((await resolveExercisesForWorkout(userId, segments, db)).get("bird-dog")).toMatchObject({
      status: "missing",
    });
  });

  it("spätere Pläne dürfen gespeicherte eigene Übungen referenzieren", async () => {
    await importLocalhubPlan(plan(), { db, userId });
    const refOnly = plan() as Partial<RawPlan>;
    delete refOnly.exerciseDefinitions;
    const result = await importLocalhubPlan(refOnly, { db, userId });
    expect(result.success).toBe(true);
  });

  it("completed-Workouts bleiben unangetastet", async () => {
    const done = await db.plannedWorkout.create({
      data: {
        userId,
        date: parseIsoDate("2026-10-06"),
        sport: "strength",
        title: "Schon erledigt",
        plannedDurationMin: 30,
        status: "completed",
        segmentsJson: [],
      },
    });
    const result = await importLocalhubPlan(plan(), { db, userId });
    expect(result.success).toBe(true);
    const after = await db.plannedWorkout.findUnique({ where: { id: done.id } });
    expect(after).toMatchObject({ status: "completed", title: "Schon erledigt" });
  });

  it("ungültige gespeicherte Definitionen werden beim Lesen übersprungen", async () => {
    await db.customExercise.create({
      data: { userId, exerciseId: "kaputt", definitionJson: { id: "kaputt" } },
    });
    expect(await listValidCustomExercises(userId, db)).toEqual([]);
    const resolved = await resolveExercisesForWorkout(userId, [{ exercise: { id: "kaputt" } }], db);
    expect(resolved.get("kaputt")).toMatchObject({ status: "invalid" });
  });

  it("blockiert beim Nutzer-Limit und speichert nichts", async () => {
    await db.customExercise.createMany({
      data: Array.from({ length: 200 }, (_, i) => ({
        userId,
        exerciseId: `custom-${i}`,
        definitionJson: {},
      })),
    });
    const result = await importLocalhubPlan(plan(), { db, userId });
    expect(result.success).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(["CUSTOM_EXERCISE_LIMIT"]);
    expect(await db.customExercise.count({ where: { userId } })).toBe(200);
    expect(await db.plannedWorkout.count()).toBe(0);
  });

  it("liefert Übungszeilen für den Kalender (Thumb, Titel, Dosis)", async () => {
    await importLocalhubPlan(plan(), { db, userId });
    const workouts = await db.plannedWorkout.findMany({ where: { userId } });
    const rows = await buildWorkoutExerciseRows(userId, workouts, db);
    const strength = workouts.find((w) => w.sport === "strength")!;
    const rest = workouts.find((w) => w.sport === "rest")!;
    expect(rows[rest.id]).toBeUndefined();
    const list = rows[strength.id];
    expect(list.map((r) => r.id)).toEqual([
      "cat-cow",
      "clamshell",
      "dead-bug",
      "copenhagen-plank",
      "bird-dog",
      "thoracic-rotation",
    ]);
    expect(list[1]).toMatchObject({ title: "Clamshell", dose: "2 × 15 pro Seite", linkable: true });
    expect(list[4]).toMatchObject({ title: "Bird Dog", linkable: true });
    expect(list[4].thumbSvg).toContain("<svg");

    // Anderer Nutzer: eigene Übung von A ist dort unbekannt.
    const userB = await otherUser();
    const rowsB = await buildWorkoutExerciseRows(userB, [strength], db);
    expect(rowsB[strength.id][4]).toMatchObject({ title: "bird-dog", thumbSvg: null, linkable: false });
  });
});
