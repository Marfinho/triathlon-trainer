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

import { GET, POST, DELETE } from "@/app/api/nutrition/consent/route";

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

describe("GET /api/nutrition/consent", () => {
  it("liefert null, solange keine Einwilligung erteilt wurde", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nutritionConsentAt).toBeNull();
  });

  it("lehnt nicht eingeloggte Nutzer mit 401 ab", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/nutrition/consent", () => {
  it("setzt nutritionConsentAt", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nutritionConsentAt).not.toBeNull();

    const user = await db.user.findUnique({ where: { id: userId } });
    expect(user?.nutritionConsentAt).not.toBeNull();
  });
});

describe("DELETE /api/nutrition/consent", () => {
  it("widerruft die Einwilligung, ohne bestehende Daten zu löschen", async () => {
    await POST();
    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nutritionConsentAt).toBeNull();

    const user = await db.user.findUnique({ where: { id: userId } });
    expect(user?.nutritionConsentAt).toBeNull();
  });
});
