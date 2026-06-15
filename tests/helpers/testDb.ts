import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Legt eine frische SQLite-Test-Datenbank an, pusht das Prisma-Schema und gibt
 * einen darauf verbundenen Client zurück. `cleanup()` trennt die Verbindung und
 * löscht die Datei.
 */
export function createTestDb(): {
  db: PrismaClient;
  cleanup: () => Promise<void>;
} {
  const dir = mkdtempSync(path.join(tmpdir(), "localhub-test-"));
  const file = path.join(dir, "test.db");
  const url = `file:${file}`;

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });

  const db = new PrismaClient({ datasourceUrl: url });

  return {
    db,
    cleanup: async () => {
      await db.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Löscht alle Tabellen (Reihenfolge wegen Relationen). */
export async function resetDb(db: PrismaClient): Promise<void> {
  await db.syncLog.deleteMany();
  await db.syncQueue.deleteMany();
  await db.intervalsWorkoutSync.deleteMany();
  await db.plannedWorkout.deleteMany();
  await db.trainingPlanImport.deleteMany();
  await db.actualActivity.deleteMany();
  await db.coachSummaryExport.deleteMany();
  await db.readinessSnapshot.deleteMany();
  await db.painSnapshot.deleteMany();
  await db.raceEvent.deleteMany();
  await db.athleteProfile.deleteMany();
}
