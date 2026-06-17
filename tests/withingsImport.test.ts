import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";
import { importWithingsBody } from "@/integrations/withings/importBody";
import type { WithingsClient, WithingsMeasureGroup } from "@/integrations/withings/client";

class MockWithingsClient implements WithingsClient {
  groups: WithingsMeasureGroup[] = [];
  async listBodyMeasurements(): Promise<WithingsMeasureGroup[]> {
    return this.groups;
  }
}

/** 2026-06-15 12:00 UTC als Unix-Sekunden. */
const D = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

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

describe("importWithingsBody", () => {
  it("importiert Gewicht und Ruhepuls und rechnet value*10^unit korrekt um", async () => {
    const client = new MockWithingsClient();
    client.groups = [
      {
        grpid: 1001,
        date: D("2026-06-15T06:00:00Z"),
        measures: [
          { value: 70500, type: 1, unit: -3 }, // 70,5 kg
          { value: 48, type: 11, unit: 0 }, // 48 bpm
        ],
      },
    ];

    const res = await importWithingsBody({ db, client, userId });
    expect(res).toEqual({ fetched: 1, created: 1, updated: 0, skipped: 0 });

    const entry = await db.bodyMetric.findFirst({ where: { externalId: "1001" } });
    expect(entry?.source).toBe("withings");
    expect(entry?.weightKg).toBe(70.5);
    expect(entry?.restingHr).toBe(48);
  });

  it("überspringt Gruppen ohne Gewicht und Puls", async () => {
    const client = new MockWithingsClient();
    client.groups = [
      { grpid: 1, date: D("2026-06-15T06:00:00Z"), measures: [{ value: 18, type: 6, unit: -1 }] }, // nur Fettanteil
      { grpid: 2, date: D("2026-06-15T07:00:00Z"), measures: [{ value: 72000, type: 1, unit: -3 }] },
    ];

    const res = await importWithingsBody({ db, client, userId });
    expect(res).toEqual({ fetched: 2, created: 1, updated: 0, skipped: 1 });
    expect(await db.bodyMetric.count()).toBe(1);
  });

  it("ist idempotent: erneuter Import aktualisiert statt zu duplizieren", async () => {
    const client = new MockWithingsClient();
    client.groups = [
      { grpid: 2002, date: D("2026-06-15T06:00:00Z"), measures: [{ value: 71000, type: 1, unit: -3 }] },
    ];
    await importWithingsBody({ db, client, userId });

    client.groups[0].measures[0].value = 70800; // korrigierter Wert, gleiche grpid
    const res = await importWithingsBody({ db, client, userId });
    expect(res).toEqual({ fetched: 1, created: 0, updated: 1, skipped: 0 });
    expect(await db.bodyMetric.count()).toBe(1);

    const entry = await db.bodyMetric.findFirst({ where: { externalId: "2002" } });
    expect(entry?.weightKg).toBe(70.8);
  });

  it("berührt manuell erfasste Körperdaten nicht", async () => {
    await db.bodyMetric.create({
      data: { userId, date: new Date("2026-06-15"), weightKg: 80, source: "manual" },
    });
    const client = new MockWithingsClient();
    client.groups = [
      { grpid: 3003, date: D("2026-06-15T06:00:00Z"), measures: [{ value: 71500, type: 1, unit: -3 }] },
    ];

    await importWithingsBody({ db, client, userId });
    expect(await db.bodyMetric.count()).toBe(2);
    const manual = await db.bodyMetric.findFirst({ where: { source: "manual" } });
    expect(manual?.weightKg).toBe(80);
  });
});
