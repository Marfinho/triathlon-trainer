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

import { GET, POST } from "@/app/api/nutrition/logs/route";
import { DELETE } from "@/app/api/nutrition/logs/[id]/route";
import { POST as grantConsent } from "@/app/api/nutrition/consent/route";

let db: PrismaClient;
let cleanup: () => Promise<void>;
let userId: string;
let otherUserId: string;
let productId: string;

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
  const other = await db.user.create({ data: { email: `other-${Date.now()}@example.com` } });
  otherUserId = other.id;
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({ user: { id: userId } });
  await grantConsent();

  const product = await db.foodProduct.create({
    data: {
      name: "Testbanane",
      kcalPer100g: 90,
      proteinGPer100g: 1.1,
      carbsGPer100g: 23,
      fatGPer100g: 0.3,
      source: "manual",
    },
  });
  productId = product.id;
});

describe("POST /api/nutrition/logs", () => {
  it("loggt eine Menge und berechnet kcal/Makros aus dem Produkt", async () => {
    const res = await POST(
      new Request("http://x/api/nutrition/logs", {
        method: "POST",
        body: JSON.stringify({ foodProductId: productId, quantityG: 200 }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.log.kcal).toBe(180);
    expect(body.log.carbsG).toBe(46);
  });

  it("lehnt fehlendes foodProductId oder quantityG <= 0 ab", async () => {
    const res = await POST(
      new Request("http://x/api/nutrition/logs", {
        method: "POST",
        body: JSON.stringify({ foodProductId: productId, quantityG: 0 }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("lehnt Produkte ab, die einem anderen Nutzer privat gehören", async () => {
    const privateProduct = await db.foodProduct.create({
      data: { name: "Privat", kcalPer100g: 50, source: "manual", createdByUserId: otherUserId },
    });
    const res = await POST(
      new Request("http://x/api/nutrition/logs", {
        method: "POST",
        body: JSON.stringify({ foodProductId: privateProduct.id, quantityG: 100 }),
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/nutrition/logs", () => {
  it("liefert nur Logs des angefragten Tages", async () => {
    await db.foodLog.create({
      data: {
        userId,
        foodProductId: productId,
        date: new Date("2026-06-15T08:00:00.000Z"),
        quantityG: 100,
        kcal: 90,
      },
    });
    await db.foodLog.create({
      data: {
        userId,
        foodProductId: productId,
        date: new Date("2026-06-16T08:00:00.000Z"),
        quantityG: 100,
        kcal: 90,
      },
    });

    const res = await GET(new Request("http://x/api/nutrition/logs?date=2026-06-15"));
    const body = await res.json();
    expect(body.logs).toHaveLength(1);
    expect(body.logs[0].foodProduct.name).toBe("Testbanane");
  });
});

describe("DELETE /api/nutrition/logs/:id", () => {
  it("löscht einen eigenen Log-Eintrag", async () => {
    const log = await db.foodLog.create({
      data: { userId, foodProductId: productId, date: new Date(), quantityG: 100, kcal: 90 },
    });
    const res = await DELETE(new Request("http://x/api/nutrition/logs/" + log.id, { method: "DELETE" }), {
      params: Promise.resolve({ id: log.id }),
    });
    expect(res.status).toBe(200);
    expect(await db.foodLog.findUnique({ where: { id: log.id } })).toBeNull();
  });

  it("lehnt das Löschen fremder Log-Einträge ab (404)", async () => {
    const log = await db.foodLog.create({
      data: { userId: otherUserId, foodProductId: productId, date: new Date(), quantityG: 100, kcal: 90 },
    });
    const res = await DELETE(new Request("http://x/api/nutrition/logs/" + log.id, { method: "DELETE" }), {
      params: Promise.resolve({ id: log.id }),
    });
    expect(res.status).toBe(404);
    expect(await db.foodLog.findUnique({ where: { id: log.id } })).not.toBeNull();
  });
});
