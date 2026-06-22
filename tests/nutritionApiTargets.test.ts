import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/localhub_test";
  return { prisma: new PrismaClient({ datasourceUrl: url }) };
});

import { GET, PUT } from "@/app/api/nutrition/targets/route";
import { POST as grantConsent } from "@/app/api/nutrition/consent/route";

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
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({ user: { id: userId } });
});

describe("GET /api/nutrition/targets ohne Einwilligung", () => {
  it("lehnt mit 403 NUTRITION_CONSENT_REQUIRED ab", async () => {
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("NUTRITION_CONSENT_REQUIRED");
  });
});

describe("/api/nutrition/targets mit Einwilligung", () => {
  beforeEach(async () => {
    await grantConsent();
  });

  it("liefert null, solange kein Ziel gesetzt ist", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.target).toBeNull();
  });

  it("legt ein Tagesziel per PUT an und liest es danach wieder", async () => {
    const putRes = await PUT(
      new Request("http://x/api/nutrition/targets", {
        method: "PUT",
        body: JSON.stringify({ targetKcal: 2800, targetProteinG: 140, targetCarbsG: 350, targetFatG: 90 }),
      }),
    );
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.target.targetKcal).toBe(2800);
    expect(putBody.target.targetProteinG).toBe(140);

    const getRes = await GET();
    const getBody = await getRes.json();
    expect(getBody.target.targetKcal).toBe(2800);
  });

  it("aktualisiert ein bestehendes Ziel (upsert) statt zu duplizieren", async () => {
    await PUT(
      new Request("http://x/api/nutrition/targets", {
        method: "PUT",
        body: JSON.stringify({ targetKcal: 2500 }),
      }),
    );
    await PUT(
      new Request("http://x/api/nutrition/targets", {
        method: "PUT",
        body: JSON.stringify({ targetKcal: 3000 }),
      }),
    );
    expect(await db.dailyNutritionTarget.count()).toBe(1);
    const target = await db.dailyNutritionTarget.findUnique({ where: { userId } });
    expect(target?.targetKcal).toBe(3000);
  });

  it("ignoriert negative Werte (-> null)", async () => {
    const res = await PUT(
      new Request("http://x/api/nutrition/targets", {
        method: "PUT",
        body: JSON.stringify({ targetKcal: -100 }),
      }),
    );
    const body = await res.json();
    expect(body.target.targetKcal).toBeNull();
  });
});
