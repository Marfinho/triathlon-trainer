import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Test-Datenbank (PostgreSQL). Alle DB-Tests teilen sich EINE Test-DB
 * (TEST_DATABASE_URL); dank `fileParallelism:false` laufen sie sequenziell.
 * `resetDb` leert alles und legt einen frischen User an, dessen id zurückkommt.
 */
const TEST_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://localhub@localhost:5432/localhub_test";

let schemaPushed = false;

export function createTestDb(): {
  db: PrismaClient;
  cleanup: () => Promise<void>;
} {
  if (!schemaPushed) {
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      env: { ...process.env, DATABASE_URL: TEST_URL },
      stdio: "ignore",
    });
    schemaPushed = true;
  }

  const db = new PrismaClient({ datasourceUrl: TEST_URL });

  return {
    db,
    cleanup: async () => {
      await db.$disconnect();
    },
  };
}

/**
 * Leert die DB (User-Löschung kaskadiert auf alle Domänen-Tabellen) und legt
 * einen frischen Test-User an. Gibt dessen id zurück.
 */
export async function resetDb(db: PrismaClient): Promise<string> {
  await db.user.deleteMany();
  const user = await db.user.create({
    data: { email: `test-${Date.now()}-${Math.random()}@example.com` },
  });
  return user.id;
}
