import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";
import { MockIntervalsClient } from "./helpers/mockIntervalsClient";
import { importLocalhubPlan } from "@/domain/plan-import/importLocalhubPlan";
import { processSyncQueue } from "@/integrations/intervals/syncQueue";
import { parseIsoDate } from "@/domain/training/dates";
import type { LocalhubPlan } from "@/domain/schemas";

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
    planName: "Sync-Woche",
    generatedAt: "2026-06-14T10:00:00Z",
    planStart: "2026-06-15",
    planDays: 3,
    planEnd: "2026-06-17",
    entries: [
      { date: "2026-06-15", sport: "run", title: "Lauf", plannedDurationMin: 60, plannedDistanceM: 10000, rpe: 3, description: null, segments: [] },
      { date: "2026-06-16", sport: "rest", title: "Ruhetag", plannedDurationMin: 0, plannedDistanceM: null, rpe: null, description: null, segments: [] },
      { date: "2026-06-17", sport: "bike", title: "Rad", plannedDurationMin: 90, plannedDistanceM: 40000, rpe: 3, description: null, segments: [] },
    ],
  };
}

/** Bildet den Ablauf der API-Route nach: Import gefolgt von Instant-Sync. */
async function importThenSync(plan: unknown, client: MockIntervalsClient) {
  const result = await importLocalhubPlan(plan, { db, userId, triggeredBy: "ui_import" });
  const sync = result.success
    ? await processSyncQueue({ db, client, userId, triggeredBy: "import_autosync" })
    : null;
  return { result, sync };
}

describe("Instant-Sync nach Planimport", () => {
  it("pusht neue Workouts sofort nach Intervals.icu (ohne Ruhetage)", async () => {
    const client = new MockIntervalsClient();
    const { result, sync } = await importThenSync(validPlan(), client);

    expect(result.success).toBe(true);
    // 2 Trainingstage (Lauf + Rad), Ruhetag wird nicht synchronisiert.
    expect(client.calls.create).toBe(2);
    expect(sync).toEqual({ processed: 2, succeeded: 2, failed: 0 });

    const synced = await db.plannedWorkout.findMany({
      where: { status: "synced" },
    });
    expect(synced).toHaveLength(2);

    const links = await db.intervalsWorkoutSync.findMany();
    expect(links).toHaveLength(2);
    expect(links.every((l) => l.intervalsEventId && l.syncStatus === "synced")).toBe(true);

    const jobs = await db.syncQueue.findMany();
    expect(jobs.every((j) => j.status === "success")).toBe(true);
  });

  it("entfernt ersetzte, bereits synchronisierte Workouts sofort aus Intervals.icu", async () => {
    const open = await db.plannedWorkout.create({
      data: {
        userId,
        date: parseIsoDate("2026-06-16"),
        sport: "bike",
        title: "Altes synced",
        plannedDurationMin: 60,
        status: "synced",
        source: "plan_import",
      },
    });
    await db.intervalsWorkoutSync.create({
      data: { userId, localWorkoutId: open.id, intervalsEventId: "evt-old", syncStatus: "synced" },
    });

    const client = new MockIntervalsClient();
    await importThenSync(validPlan(), client);

    // Altes Event wurde gelöscht, neue Workouts angelegt.
    expect(client.calls.delete).toBe(1);
    expect(client.calls.create).toBe(2);

    const oldSync = await db.intervalsWorkoutSync.findUnique({
      where: { localWorkoutId: open.id },
    });
    expect(oldSync?.syncStatus).toBe("superseded");
  });

  it("ist idempotent: erneuter Import/Sync erzeugt keine Duplikate", async () => {
    const client = new MockIntervalsClient();
    await importThenSync(validPlan(), client);
    const createsAfterFirst = client.calls.create;

    // Zweiter identischer Import ersetzt erneut, legt neue an, synchronisiert.
    await importThenSync(validPlan(), client);

    // Neue Workouts -> neue Events (alte werden gelöscht), aber keine Doppelung
    // pro aktivem Workout: Anzahl aktiver synced-Links bleibt 2.
    const activeLinks = await db.intervalsWorkoutSync.findMany({
      where: { syncStatus: "synced" },
    });
    expect(activeLinks).toHaveLength(2);
    expect(client.calls.create).toBeGreaterThan(createsAfterFirst);
  });
});
