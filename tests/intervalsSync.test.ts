import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";
import { MockIntervalsClient } from "./helpers/mockIntervalsClient";
import { syncPlannedWorkout } from "@/integrations/intervals/syncPlannedWorkout";
import { processSyncQueue } from "@/integrations/intervals/syncQueue";
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

async function createWorkout(overrides: Record<string, unknown> = {}) {
  return db.plannedWorkout.create({
    data: {
      userId,
      date: parseIsoDate("2026-06-15"),
      sport: "run",
      title: "Dauerlauf",
      plannedDurationMin: 60,
      plannedDistanceM: 10000,
      description: "GA1",
      segmentsJson: [],
      status: "planned",
      source: "plan_import",
      ...overrides,
    },
  });
}

describe("syncPlannedWorkout", () => {
  it("erstellt ein Event beim ersten Sync und verknüpft es", async () => {
    const w = await createWorkout();
    const client = new MockIntervalsClient();

    const outcome = await syncPlannedWorkout(w.id, { db, client, userId });
    expect(outcome.action).toBe("created");
    expect(client.calls.create).toBe(1);
    expect(outcome.intervalsEventId).toBeDefined();

    const sync = await db.intervalsWorkoutSync.findUnique({
      where: { localWorkoutId: w.id },
    });
    expect(sync?.intervalsEventId).toBe(outcome.intervalsEventId);
    expect(sync?.lastSyncedHash).toBe(outcome.hash);

    const after = await db.plannedWorkout.findUnique({ where: { id: w.id } });
    expect(after?.status).toBe("synced");
  });

  it("ist idempotent: unveränderter Workout -> kein erneuter API-Call", async () => {
    const w = await createWorkout();
    const client = new MockIntervalsClient();

    await syncPlannedWorkout(w.id, { db, client, userId });
    const second = await syncPlannedWorkout(w.id, { db, client, userId });

    expect(second.action).toBe("skipped");
    expect(client.calls.create).toBe(1); // kein zweites Create
    expect(client.calls.update).toBe(0);
  });

  it("aktualisiert statt zu duplizieren, wenn sich der Workout ändert", async () => {
    const w = await createWorkout();
    const client = new MockIntervalsClient();

    const first = await syncPlannedWorkout(w.id, { db, client, userId });

    await db.plannedWorkout.update({
      where: { id: w.id },
      data: { plannedDurationMin: 75 },
    });
    const second = await syncPlannedWorkout(w.id, { db, client, userId });

    expect(second.action).toBe("updated");
    expect(client.calls.create).toBe(1); // kein neues Event
    expect(client.calls.update).toBe(1);
    expect(second.intervalsEventId).toBe(first.intervalsEventId);
    expect(second.hash).not.toBe(first.hash);
  });

  it("verknüpft ein bestehendes Intervals-Event statt ein Duplikat zu erstellen", async () => {
    const w = await createWorkout();
    const client = new MockIntervalsClient();
    client.preset = { id: "existing-99", name: "Dauerlauf" };

    const outcome = await syncPlannedWorkout(w.id, { db, client, userId });
    expect(outcome.action).toBe("linked");
    expect(outcome.intervalsEventId).toBe("existing-99");
    expect(client.calls.create).toBe(0);
    expect(client.calls.update).toBe(1);
  });

  it("synchronisiert weder rest noch completed Workouts", async () => {
    const rest = await createWorkout({ sport: "rest", plannedDurationMin: 0 });
    const done = await createWorkout({ status: "completed" });
    const client = new MockIntervalsClient();

    expect((await syncPlannedWorkout(rest.id, { db, client, userId })).action).toBe(
      "noop",
    );
    expect((await syncPlannedWorkout(done.id, { db, client, userId })).action).toBe(
      "noop",
    );
    expect(client.calls.create).toBe(0);
  });
});

describe("processSyncQueue", () => {
  it("verarbeitet create-Jobs erfolgreich", async () => {
    const w = await createWorkout();
    await db.syncQueue.create({
      data: { userId, localWorkoutId: w.id, action: "create", status: "pending" },
    });
    const client = new MockIntervalsClient();

    const result = await processSyncQueue({ db, client, userId });
    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(client.calls.create).toBe(1);

    const job = await db.syncQueue.findFirst();
    expect(job?.status).toBe("success");
    expect(job?.attempts).toBe(1);
  });

  it("verarbeitet delete-Jobs und markiert Sync als superseded", async () => {
    const w = await createWorkout({ status: "replaced" });
    await db.intervalsWorkoutSync.create({
      data: {
        userId,
        localWorkoutId: w.id,
        intervalsEventId: "evt-del",
        syncStatus: "synced",
      },
    });
    await db.syncQueue.create({
      data: {
        userId,
        localWorkoutId: w.id,
        intervalsEventId: "evt-del",
        action: "delete",
        status: "pending",
      },
    });
    const client = new MockIntervalsClient();

    const result = await processSyncQueue({ db, client, userId });
    expect(result.succeeded).toBe(1);
    expect(client.calls.delete).toBe(1);

    const sync = await db.intervalsWorkoutSync.findUnique({
      where: { localWorkoutId: w.id },
    });
    expect(sync?.syncStatus).toBe("superseded");
  });

  it("ist über mehrere Läufe idempotent (zweiter Lauf hat nichts zu tun)", async () => {
    const w = await createWorkout();
    await db.syncQueue.create({
      data: { userId, localWorkoutId: w.id, action: "create", status: "pending" },
    });
    const client = new MockIntervalsClient();

    await processSyncQueue({ db, client, userId });
    const second = await processSyncQueue({ db, client, userId });
    expect(second.processed).toBe(0); // keine pending Jobs mehr
    expect(client.calls.create).toBe(1);
  });

  it("hält fehlgeschlagene Jobs unter maxAttempts auf pending", async () => {
    const w = await createWorkout();
    await db.syncQueue.create({
      data: { userId, localWorkoutId: w.id, action: "create", status: "pending" },
    });
    const failing = new MockIntervalsClient();
    failing.createEvent = async () => {
      throw new Error("API down");
    };

    const result = await processSyncQueue({
      db,
      client: failing,
      userId,
      maxAttempts: 3,
    });
    expect(result.failed).toBe(1);

    const job = await db.syncQueue.findFirst();
    expect(job?.status).toBe("pending"); // Retry möglich
    expect(job?.attempts).toBe(1);
    expect(job?.errorMessage).toContain("API down");
  });

  it("greift fehlgeschlagene Jobs erst nach Backoff wieder auf", async () => {
    const w = await createWorkout();
    await db.syncQueue.create({
      data: { userId, localWorkoutId: w.id, action: "create", status: "pending" },
    });
    const failing = new MockIntervalsClient();
    failing.createEvent = async () => {
      throw new Error("API down");
    };

    await processSyncQueue({ db, client: failing, userId, maxAttempts: 3 });
    const job = await db.syncQueue.findFirst();
    expect(job?.nextAttemptAt).not.toBeNull();
    expect(job!.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());

    // Solange das Backoff-Fenster läuft, wird der Job nicht erneut aufgegriffen.
    const second = await processSyncQueue({ db, client: failing, userId, maxAttempts: 3 });
    expect(second.processed).toBe(0);

    // Nach Ablauf des Fensters wird er wieder aufgegriffen.
    await db.syncQueue.update({
      where: { id: job!.id },
      data: { nextAttemptAt: new Date(Date.now() - 1000) },
    });
    const third = await processSyncQueue({ db, client: failing, userId, maxAttempts: 3 });
    expect(third.processed).toBe(1);
    expect(third.failed).toBe(1);
  });
});
