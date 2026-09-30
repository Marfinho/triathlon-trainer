import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";
import {
  buildBackupForUser,
  parseBackup,
  restoreBackup,
  BACKUP_VERSION,
  type BackupFile,
} from "@/lib/backup";
import birdDog from "./fixtures/exercises/example-custom-exercise.json";

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

/** Leeres data-Gerüst, das dem zod-Schema genügt. */
function emptyData(): BackupFile["data"] {
  return {
    profile: null,
    raceEvents: [],
    plannedWorkouts: [],
    actualActivities: [],
    gearItems: [],
    trainingGoals: [],
    bodyMetrics: [],
    journalEntries: [],
    readinessSnapshots: [],
    painSnapshots: [],
    customExercises: [],
    integrations: [],
  };
}

describe("buildBackupForUser", () => {
  it("exportiert die Nutzerdaten ohne apiKey", async () => {
    await db.raceEvent.create({
      data: {
        userId,
        name: "Stadtlauf",
        date: new Date("2026-09-01"),
        type: "run",
      },
    });
    await db.actualActivity.create({
      data: {
        userId,
        source: "manual",
        externalId: "ext-1",
        date: new Date("2026-06-15"),
        sport: "run",
        durationMin: 45,
      },
    });
    await db.gearItem.create({
      data: { userId, name: "Laufschuh", type: "shoe", sport: "run" },
    });
    await db.athleteProfile.create({
      data: { userId, name: "Sven", primarySports: ["run"] },
    });

    const backup = await buildBackupForUser(db, userId, "a@b.c");
    expect(backup.version).toBe("2");
    expect(BACKUP_VERSION).toBe("2");
    expect(backup.userId).toBe(userId);
    expect(backup.data.raceEvents).toHaveLength(1);
    for (const integration of backup.data.integrations) {
      expect(Object.prototype.hasOwnProperty.call(integration, "apiKey")).toBe(
        false,
      );
    }
  });
});

describe("parseBackup", () => {
  it("akzeptiert ein gültiges Backup", async () => {
    const backup: BackupFile = {
      version: "2",
      userId,
      data: emptyData(),
    };
    const result = parseBackup(backup);
    expect(result.ok).toBe(true);
  });

  it("lehnt eine falsche Version ab (INVALID_FORMAT)", () => {
    const result = parseBackup({ version: "1", userId, data: emptyData() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_FORMAT");
  });

  it("lehnt unvollständige Daten ab (VALIDATION_FAILED)", () => {
    const result = parseBackup({ version: "2" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("VALIDATION_FAILED");
  });
});

describe("restoreBackup – Invarianten", () => {
  it("überschreibt bestehende ActualActivity nie", async () => {
    const existing = await db.actualActivity.create({
      data: {
        userId,
        source: "manual",
        externalId: "ext-keep",
        date: new Date("2026-06-15"),
        sport: "run",
        durationMin: 60,
      },
    });

    const backup: BackupFile = {
      version: "2",
      userId,
      data: {
        ...emptyData(),
        actualActivities: [
          {
            id: existing.id,
            source: "manual",
            externalId: "ext-keep",
            date: "2026-06-15",
            sport: "run",
            durationMin: 999,
          },
        ],
      },
    };

    await restoreBackup(db, userId, backup);

    const after = await db.actualActivity.findUnique({
      where: { id: existing.id },
    });
    expect(after?.durationMin).toBe(60);
  });

  it("überschreibt completed PlannedWorkouts nie", async () => {
    const done = await db.plannedWorkout.create({
      data: {
        userId,
        date: new Date("2026-06-15"),
        sport: "run",
        title: "Erledigt",
        plannedDurationMin: 50,
        status: "completed",
        segmentsJson: [],
      },
    });

    const backup: BackupFile = {
      version: "2",
      userId,
      data: {
        ...emptyData(),
        plannedWorkouts: [
          {
            id: done.id,
            date: "2026-06-15",
            sport: "run",
            title: "Geändert",
            plannedDurationMin: 50,
            status: "planned",
          },
        ],
      },
    };

    await restoreBackup(db, userId, backup);

    const after = await db.plannedWorkout.findUnique({ where: { id: done.id } });
    expect(after?.status).toBe("completed");
    expect(after?.title).toBe("Erledigt");
  });
});

describe("restoreBackup – Transaktion (Rollback)", () => {
  it("verwirft alle Änderungen, wenn ein FK-Constraint verletzt wird", async () => {
    const backup: BackupFile = {
      version: "2",
      userId,
      data: {
        ...emptyData(),
        raceEvents: [{ id: "rb1", name: "X", date: "2026-06-15", type: "run" }],
        gearItems: [
          {
            id: "g1",
            name: "bad",
            type: "component",
            parentId: "DOES_NOT_EXIST",
          },
        ],
      },
    };

    await expect(restoreBackup(db, userId, backup)).rejects.toThrow();

    const race = await db.raceEvent.findUnique({ where: { id: "rb1" } });
    expect(race).toBeNull();
  });
});

describe("Backup – eigene Übungen", () => {
  it("sichert eigene Übungen und stellt sie wieder her", async () => {
    await db.customExercise.create({
      data: { userId, exerciseId: birdDog.id, definitionJson: birdDog as object },
    });
    const backup = await buildBackupForUser(db, userId, "a@b.c");
    expect(backup.data.customExercises).toHaveLength(1);
    expect(backup.data.customExercises[0]).toMatchObject({ exerciseId: "bird-dog" });

    // Serialisieren wie beim Download, dann in einen frischen Nutzer einspielen.
    const json = JSON.parse(JSON.stringify(backup));
    const otherUser = await resetDb(db);
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = await restoreBackup(db, otherUser, parsed.backup);
    expect(result.restored.customExercises).toBe(1);

    const rows = await db.customExercise.findMany({ where: { userId: otherUser } });
    expect(rows).toHaveLength(1);
    expect(rows[0].exerciseId).toBe("bird-dog");
    expect((rows[0].definitionJson as { title: string }).title).toBe(birdDog.title);
  });

  it("überspringt ungültige Definitionen und Kollisionen mit der Bibliothek", async () => {
    const backup: BackupFile = {
      version: "2",
      userId,
      data: {
        ...emptyData(),
        customExercises: [
          { id: "c1", exerciseId: "kaputt", definitionJson: { id: "kaputt", title: "" } },
          { id: "c2", exerciseId: "plank", definitionJson: { ...birdDog, id: "plank" } },
          { id: "c3", exerciseId: "bird-dog", definitionJson: birdDog },
        ],
      },
    };
    const result = await restoreBackup(db, userId, backup);
    expect(result.restored.customExercises).toBe(1);
    expect(result.skipped).toBe(2);
    const rows = await db.customExercise.findMany({ where: { userId } });
    expect(rows.map((r) => r.exerciseId)).toEqual(["bird-dog"]);
  });

  it("akzeptiert ältere Backups ohne customExercises", () => {
    const { customExercises: _omit, ...rest } = emptyData();
    void _omit;
    const parsed = parseBackup({ version: "2", userId, data: rest });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.data.customExercises).toEqual([]);
  });
});
