import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://localhub@localhost:5432/localhub_test";
  return { prisma: new PrismaClient({ datasourceUrl: url }) };
});

import { POST, DELETE } from "@/app/api/workouts/[id]/complete/route";

let db: PrismaClient;
let cleanup: () => Promise<void>;
let userId: string;
let workoutId: string;

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (id: string, body?: object) =>
  POST(
    new Request("http://x/api/workouts/x/complete", {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
    ctx(id),
  );

beforeAll(() => {
  const c = createTestDb();
  db = c.db;
  cleanup = c.cleanup;
});
afterAll(async () => {
  await cleanup();
});
beforeEach(async () => {
  userId = await resetDb(db);
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({ user: { id: userId } });
  const w = await db.plannedWorkout.create({
    data: {
      userId,
      date: new Date("2026-11-20T00:00:00Z"),
      sport: "strength",
      title: "Rumpf A",
      plannedDurationMin: 30,
      rpe: 6,
    },
  });
  workoutId = w.id;
});

describe("POST /api/workouts/:id/complete", () => {
  it("markiert manuell als erledigt und legt eine Ist-Aktivität am geplanten Tag an", async () => {
    const res = await post(workoutId, { mode: "manual", durationMin: 25, rpe: 7 });
    expect(res.status).toBe(200);
    const w = await db.plannedWorkout.findUnique({ where: { id: workoutId } });
    expect(w?.status).toBe("completed");
    const acts = await db.actualActivity.findMany({ where: { userId } });
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({
      source: "manual",
      externalId: workoutId,
      sport: "strength",
      durationMin: 25,
      rpe: 7,
    });
    expect(acts[0].date.toISOString().slice(0, 10)).toBe("2026-11-20");
  });

  it("nutzt ohne Angaben die geplante Dauer und Ziel-RPE", async () => {
    await post(workoutId);
    const a = await db.actualActivity.findFirstOrThrow({ where: { userId } });
    expect(a.durationMin).toBe(30);
    expect(a.rpe).toBe(6);
  });

  it("geführte Einheit: Quelle guided, Datum = jetzt", async () => {
    await post(workoutId, { mode: "guided", durationMin: 18 });
    const a = await db.actualActivity.findFirstOrThrow({ where: { userId } });
    expect(a.source).toBe("guided");
    expect(a.durationMin).toBe(18);
    expect(Math.abs(a.date.getTime() - Date.now())).toBeLessThan(60_000);
  });

  it("ist idempotent – zweites Markieren legt nichts doppelt an", async () => {
    await post(workoutId, { mode: "guided", durationMin: 18 });
    const res = await post(workoutId, { mode: "manual" });
    expect((await res.json()).already).toBe(true);
    expect(await db.actualActivity.count({ where: { userId } })).toBe(1);
  });

  it("lehnt ungültige Dauer ab und ändert nichts", async () => {
    const res = await post(workoutId, { durationMin: -5 });
    expect(res.status).toBe(400);
    const w = await db.plannedWorkout.findUnique({ where: { id: workoutId } });
    expect(w?.status).toBe("planned");
  });

  it("ersetzte Einheiten können nicht erledigt werden", async () => {
    await db.plannedWorkout.update({ where: { id: workoutId }, data: { status: "replaced" } });
    const res = await post(workoutId);
    expect(res.status).toBe(409);
  });

  it("fremde Workouts → 404", async () => {
    const other = await db.user.create({ data: { email: `o-${Date.now()}@example.com` } });
    mockAuth.mockResolvedValue({ user: { id: other.id } });
    const res = await post(workoutId);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/workouts/:id/complete", () => {
  it("setzt zurück und entfernt nur die selbst angelegte Aktivität", async () => {
    await post(workoutId, { mode: "manual" });
    await db.actualActivity.create({
      data: { userId, source: "strava", externalId: "123", date: new Date(), sport: "run", durationMin: 40 },
    });
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), ctx(workoutId));
    expect(res.status).toBe(200);
    const w = await db.plannedWorkout.findUnique({ where: { id: workoutId } });
    expect(w?.status).toBe("planned");
    const acts = await db.actualActivity.findMany({ where: { userId } });
    expect(acts.map((a) => a.source)).toEqual(["strava"]);
  });
});
