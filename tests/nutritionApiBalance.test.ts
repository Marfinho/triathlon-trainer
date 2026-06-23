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

import { GET as balanceTodayGet } from "@/app/api/nutrition/balance/today/route";
import { GET as forecastGet } from "@/app/api/nutrition/balance/forecast/route";
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
  await db.foodProduct.deleteMany();
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({ user: { id: userId } });
  await grantConsent();
});

describe("GET /api/nutrition/balance/today", () => {
  it("bilanziert Zufuhr (FoodLog) gegen Trainingsverbrauch (ActualActivity)", async () => {
    const product = await db.foodProduct.create({
      data: { name: "Reis", kcalPer100g: 130, source: "manual" },
    });
    await db.foodLog.create({
      data: {
        userId,
        foodProductId: product.id,
        date: new Date("2026-06-15T08:00:00.000Z"),
        quantityG: 1000,
        kcal: 1300,
      },
    });
    await db.athleteProfile.create({ data: { userId, name: "Test", weightKg: 70, ftpWatts: 250 } });
    await db.actualActivity.create({
      data: {
        userId,
        source: "manual",
        externalId: "a1",
        date: new Date("2026-06-15T07:00:00.000Z"),
        sport: "run",
        durationMin: 60,
      },
    });

    const res = await balanceTodayGet(new Request("http://x/api/nutrition/balance/today?date=2026-06-15"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intake.kcal).toBe(1300);
    expect(body.burnedKcal).toBeGreaterThan(0);
    expect(body.balance.netKcal).toBe(1300 - body.burnedKcal);
  });

  it("liefert Status 'unknown', solange kein Tagesziel gesetzt ist", async () => {
    const res = await balanceTodayGet(new Request("http://x/api/nutrition/balance/today?date=2026-06-15"));
    const body = await res.json();
    expect(body.balance.status).toBe("unknown");
    expect(body.intake.kcal).toBe(0);
    expect(body.burnedKcal).toBe(0);
  });
});

describe("GET /api/nutrition/balance/forecast", () => {
  it("schätzt den Energiebedarf geplanter Einheiten mit Quelle+Konfidenz", async () => {
    await db.athleteProfile.create({ data: { userId, name: "Test", weightKg: 70, ftpWatts: 250 } });
    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    await db.plannedWorkout.create({
      data: {
        userId,
        date: tomorrow,
        sport: "run",
        plannedDurationMin: 60,
        title: "Long Run",
        status: "planned",
      },
    });

    const res = await forecastGet(new Request("http://x/api/nutrition/balance/forecast?days=3"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.perWorkout).toHaveLength(1);
    expect(body.perWorkout[0].source).toBe("estimated_duration_weight");
    expect(body.perWorkout[0].confidence).toBe("medium");
    expect(body.byDay).toHaveLength(1);
    expect(body.byDay[0].kcal).toBe(body.perWorkout[0].kcal);
  });

  it("begrenzt days auf den erlaubten Bereich (1..7)", async () => {
    const res = await forecastGet(new Request("http://x/api/nutrition/balance/forecast?days=99"));
    const body = await res.json();
    expect(body.days).toBe(7);
  });

  it("liefert eine leere Liste, wenn keine Einheiten geplant sind", async () => {
    const res = await forecastGet(new Request("http://x/api/nutrition/balance/forecast"));
    const body = await res.json();
    expect(body.perWorkout).toEqual([]);
    expect(body.byDay).toEqual([]);
  });
});
