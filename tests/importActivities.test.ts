import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";
import { MockIntervalsClient } from "./helpers/mockIntervalsClient";
import {
  importActivitiesFromIntervals,
  intervalsTypeToSport,
} from "@/integrations/intervals/importActivities";

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

describe("intervalsTypeToSport", () => {
  it("mappt bekannte Typen, sonst other", () => {
    expect(intervalsTypeToSport("Run")).toBe("run");
    expect(intervalsTypeToSport("VirtualRide")).toBe("bike");
    expect(intervalsTypeToSport("OpenWaterSwim")).toBe("swim");
    expect(intervalsTypeToSport("Kitesurf")).toBe("other");
    expect(intervalsTypeToSport(null)).toBe("other");
  });
});

describe("importActivitiesFromIntervals", () => {
  it("importiert Aktivitäten und mappt die Felder", async () => {
    const client = new MockIntervalsClient();
    client.activitiesList = [
      {
        id: "act-1",
        start_date_local: "2026-06-15T07:00:00",
        type: "Ride",
        moving_time: 3600,
        distance: 40000,
        icu_training_load: 95,
        average_heartrate: 142,
      },
      {
        id: "act-2",
        start_date_local: "2026-06-14T18:00:00",
        type: "Swim",
        moving_time: 1800,
        distance: 2000,
      },
    ];

    const res = await importActivitiesFromIntervals({ db, client, userId, sinceDays: 30, today: new Date("2026-06-16") });
    expect(res).toEqual({ fetched: 2, created: 2, updated: 0 });

    const ride = await db.actualActivity.findFirst({ where: { externalId: "act-1" } });
    expect(ride?.sport).toBe("bike");
    expect(ride?.durationMin).toBe(60);
    expect(ride?.distanceKm).toBe(40);
    expect(ride?.load).toBe(95);
    expect(ride?.avgHr).toBe(142);
  });

  it("ist idempotent: erneuter Import aktualisiert statt zu duplizieren", async () => {
    const client = new MockIntervalsClient();
    client.activitiesList = [
      { id: "act-1", start_date_local: "2026-06-15T07:00:00", type: "Run", moving_time: 3000, distance: 10000 },
    ];
    await importActivitiesFromIntervals({ db, client, userId, today: new Date("2026-06-16") });

    // gleiche Aktivität, aktualisierte Dauer
    client.activitiesList[0].moving_time = 3120;
    const res = await importActivitiesFromIntervals({ db, client, userId, today: new Date("2026-06-16") });
    expect(res).toEqual({ fetched: 1, created: 0, updated: 1 });
    expect(await db.actualActivity.count()).toBe(1);

    const run = await db.actualActivity.findFirst({ where: { externalId: "act-1" } });
    expect(run?.durationMin).toBe(52);
  });

  it("berührt manuelle Aktivitäten anderer Quellen nicht", async () => {
    await db.actualActivity.create({
      data: { userId, source: "manual", externalId: "m1", date: new Date("2026-06-15"), sport: "run", durationMin: 30 },
    });
    const client = new MockIntervalsClient();
    client.activitiesList = [
      { id: "m1", start_date_local: "2026-06-15T07:00:00", type: "Run", moving_time: 3000 },
    ];
    await importActivitiesFromIntervals({ db, client, userId, today: new Date("2026-06-16") });
    // gleiche externalId aber andere source -> neuer Datensatz, manueller bleibt
    expect(await db.actualActivity.count()).toBe(2);
  });
});
