import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";
import { importLocalhubPlan } from "@/domain/plan-import/importLocalhubPlan";
import type { LocalhubPlan } from "@/domain/schemas";
import { parseIsoDate } from "@/domain/training/dates";

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

function validPlan(): LocalhubPlan {
  return {
    schemaVersion: "1.0",
    type: "localhub_plan",
    planName: "Importwoche",
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
        segments: [],
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
        sport: "bike",
        title: "Radausfahrt",
        plannedDurationMin: 90,
        plannedDistanceM: 40000,
        rpe: 3,
        description: null,
        segments: [],
      },
    ],
  };
}

describe("importLocalhubPlan", () => {
  it("importiert einen gültigen Plan und legt Workouts + Import + Sync-Jobs an", async () => {
    const result = await importLocalhubPlan(validPlan(), { db, userId });
    expect(result.success).toBe(true);
    expect(result.importJobId).toBeDefined();
    expect(result.preview?.createdCount).toBe(3);

    const workouts = await db.plannedWorkout.findMany({
      orderBy: { date: "asc" },
    });
    expect(workouts).toHaveLength(3);
    expect(workouts.every((w) => w.planImportId === result.importJobId)).toBe(
      true,
    );
    expect(workouts.every((w) => w.status === "planned")).toBe(true);

    const imports = await db.trainingPlanImport.findMany();
    expect(imports).toHaveLength(1);
    expect(imports[0].validationStatus).toBe("imported");

    // Nur Nicht-Ruhetage erzeugen Create-Sync-Jobs (run + bike = 2).
    const jobs = await db.syncQueue.findMany();
    expect(jobs.filter((j) => j.action === "create")).toHaveLength(2);
  });

  it("ersetzt offene Workouts, lässt completed unangetastet", async () => {
    // Vorbereitung: ein completed + ein offenes Workout im Zeitraum.
    const completed = await db.plannedWorkout.create({
      data: {
        userId,
        date: parseIsoDate("2026-06-15"),
        sport: "run",
        title: "Bereits erledigt",
        plannedDurationMin: 50,
        status: "completed",
        source: "plan_import",
      },
    });
    const open = await db.plannedWorkout.create({
      data: {
        userId,
        date: parseIsoDate("2026-06-16"),
        sport: "bike",
        title: "Altes geplantes",
        plannedDurationMin: 60,
        status: "planned",
        source: "plan_import",
      },
    });

    const result = await importLocalhubPlan(validPlan(), { db, userId });
    expect(result.success).toBe(true);
    expect(result.preview?.replacedCount).toBe(1);
    expect(result.preview?.protectedCount).toBe(1);

    const completedAfter = await db.plannedWorkout.findUnique({
      where: { id: completed.id },
    });
    expect(completedAfter?.status).toBe("completed");
    expect(completedAfter?.title).toBe("Bereits erledigt");

    const openAfter = await db.plannedWorkout.findUnique({
      where: { id: open.id },
    });
    expect(openAfter?.status).toBe("replaced");

    // 3 neue + 1 completed + 1 replaced = 5 gesamt.
    expect(await db.plannedWorkout.count()).toBe(5);
  });

  it("erzeugt Delete-Job für ersetzte, bereits synchronisierte Workouts", async () => {
    const open = await db.plannedWorkout.create({
      data: {
        userId,
        date: parseIsoDate("2026-06-16"),
        sport: "bike",
        title: "Synced workout",
        plannedDurationMin: 60,
        status: "synced",
        source: "plan_import",
      },
    });
    await db.intervalsWorkoutSync.create({
      data: {
        userId,
        localWorkoutId: open.id,
        intervalsEventId: "evt-123",
        syncStatus: "synced",
      },
    });

    const result = await importLocalhubPlan(validPlan(), { db, userId });
    expect(result.success).toBe(true);

    const deleteJobs = await db.syncQueue.findMany({
      where: { action: "delete" },
    });
    expect(deleteJobs).toHaveLength(1);
    expect(deleteJobs[0].intervalsEventId).toBe("evt-123");

    const sync = await db.intervalsWorkoutSync.findUnique({
      where: { localWorkoutId: open.id },
    });
    expect(sync?.syncStatus).toBe("superseded");
  });

  it("lehnt ungültigen Plan ab ohne jede DB-Änderung", async () => {
    const invalid = { ...validPlan(), planEnd: "2026-06-30" };
    const result = await importLocalhubPlan(invalid, { db, userId });
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    expect(await db.plannedWorkout.count()).toBe(0);
    expect(await db.trainingPlanImport.count()).toBe(0);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it("behandelt Export-Mismatch als Warnung, nicht als Blocker", async () => {
    await db.coachSummaryExport.create({
      data: {
        userId,
        schemaVersion: "1.0",
        exportPurpose: "training_plan",
        requestedFormat: "localhub_plan_json",
        planStart: parseIsoDate("2026-07-01"),
        planDays: 7,
        includedModulesJson: "[]",
        modulesJson: "{}",
        chatGptInstructionJson: "{}",
      },
    });

    const result = await importLocalhubPlan(validPlan(), { db, userId });
    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.code === "EXPORT_MISMATCH")).toBe(true);
    expect(await db.plannedWorkout.count()).toBe(3);
  });
});
