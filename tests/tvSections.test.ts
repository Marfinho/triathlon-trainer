import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";
import { tvExtras, tvKind, tvProfile, tvRace, tvToday, tvWeek } from "@/lib/tv/sections";
import { createCheckin } from "@/lib/checkin";

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

const NOW = new Date("2026-10-07T09:00:00Z");
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000);

async function seed() {
  await db.athleteProfile.create({
    data: { userId, name: "Sven", ftpWatts: 250, thresholdHr: 168, thresholdPaceSecPerKm: 270, weightKg: 74 },
  });
  for (let i = 1; i <= 20; i++) {
    await db.actualActivity.create({
      data: { userId, source: "intervals", externalId: `a${i}`, date: day(-i), sport: i % 2 ? "run" : "bike", durationMin: 60, distanceKm: 20, load: 60 },
    });
  }
  await db.plannedWorkout.create({
    data: { userId, date: new Date("2026-10-07T00:00:00Z"), sport: "bike", title: "Sweet Spot", plannedDurationMin: 60 },
  });
  await db.plannedWorkout.create({
    data: {
      userId, date: new Date("2026-10-08T00:00:00Z"), sport: "strength", title: "Rumpf", plannedDurationMin: 20,
      segmentsJson: [{ type: "other", exercise: { id: "glute-bridge", sets: 2, reps: 12 } }],
    },
  });
  await db.plannedWorkout.create({
    data: { userId, date: new Date("2026-10-09T00:00:00Z"), sport: "run", title: "Lauf", plannedDurationMin: 45 },
  });
  await db.raceEvent.create({
    data: { userId, name: "Stadtlauf", date: new Date("2026-11-15T00:00:00Z"), type: "run", distance: "10k", priority: "A" },
  });
  await db.trainingGoal.create({ data: { userId, sport: "bike", weeklyTargetMin: 300 } });
  await db.gearItem.create({ data: { userId, name: "Laufschuh", type: "shoe", sport: "run", autoTrack: true, alertKm: 600 } });
  await db.bodyMetric.create({ data: { userId, date: day(-1), weightKg: 74.2, restingHr: 48 } });
}

describe("TV-Bereiche", () => {
  it("ordnet Einheiten dem abspielbaren Typ zu", () => {
    expect(tvKind("bike", [])).toBe("bike");
    expect(tvKind("brick", [])).toBe("bike");
    expect(tvKind("strength", [])).toBe("strength");
    expect(tvKind("run", [{ exercise: { id: "x" } }])).toBe("strength");
    expect(tvKind("run", [])).toBe("other");
  });

  it("Heute: geplante Einheit, Form, nächster Wettkampf, Wochenziele, Check-in", async () => {
    await seed();
    const empty = await tvToday(userId, db, NOW);
    expect(empty.readiness).toBeNull();
    const res = await createCheckin(userId, { readiness: { status: "yellow", subjectiveFatigue: 6, sleepTrend: "schlechter" }, pain: { overall: 2 } }, db);
    expect(res.ok).toBe(true);
    const t = await tvToday(userId, db, NOW);
    expect(t.date).toBe("2026-10-07");
    expect(t.athleteName).toBe("Sven");
    expect(t.planned).toEqual([expect.objectContaining({ title: "Sweet Spot", kind: "bike" })]);
    expect(t.form.label).toBeTruthy();
    expect(typeof t.form.ctl).toBe("number");
    expect(t.readiness).toMatchObject({ status: "yellow", subjectiveFatigue: 6, sleepTrend: "schlechter" });
    expect(t.painLatest?.overall).toBe(2);
    expect(t.nextRace).toMatchObject({ name: "Stadtlauf", date: "2026-11-15", daysToRace: 39, priority: "A" });
    expect(t.weeklyGoals[0]).toMatchObject({ sport: "bike", targetMin: 300 });
  });

  it("Check-in ohne Daten wird abgelehnt", async () => {
    expect(await createCheckin(userId, {}, db)).toEqual({ ok: false, error: "Keine Daten übergeben." });
  });

  it("Woche: Kalendertage mit abspielbaren Einheiten, Ziele, letzte Aktivitäten", async () => {
    await seed();
    const w = await tvWeek(userId, db, NOW);
    expect(w.days).toHaveLength(28);
    const today = w.days.find((d) => d.isToday)!;
    expect(today.date).toBe("2026-10-07");
    expect(today.items[0]).toMatchObject({ kind: "planned", label: "Sweet Spot", playable: "bike" });
    expect(w.days.find((d) => d.date === "2026-10-08")!.items[0].playable).toBe("strength");
    expect(w.days.find((d) => d.date === "2026-10-09")!.items[0].playable).toBe("other");
    expect(w.recent[0]).toMatchObject({ date: "2026-10-06", durationMin: 60 });
    expect(w.compliance.length).toBeGreaterThan(0);
  });

  it("Wettkampf: Countdown, Phase und Prognose", async () => {
    await seed();
    const r = await tvRace(userId, db, NOW);
    expect(r.races[0]).toMatchObject({ name: "Stadtlauf", daysToRace: 39, phase: "Aufbau", completed: false });
    expect(r.races[0].forecast === null || r.races[0].forecast.likelySec > 0).toBe(true);
  });

  it("Extras: Zonen, Statistik, Körper, Ausrüstung", async () => {
    await seed();
    const e = await tvExtras(userId, db, NOW);
    expect(e.zones.map((z) => z.title)).toEqual(["Leistung", "Herzfrequenz", "Lauf-Pace"]);
    expect(e.zones[0].zones.length).toBeGreaterThan(4);
    expect(e.seasonStats.totalSessions).toBe(20);
    expect(e.body.latestWeight).toBe(74.2);
    expect(e.gear[0]).toMatchObject({ name: "Laufschuh", depth: 0 });
    expect(e.gear[0].km).toBeGreaterThan(0);
  });

  it("Profil: Schwellenwerte und Ziele, keine internen Felder", async () => {
    await seed();
    const p = await tvProfile(userId, db);
    expect(p.athlete).toMatchObject({ ftpWatts: 250, thresholdHr: 168, weightKg: 74 });
    expect(p.weeklyGoals).toEqual([{ sport: "bike", weeklyTargetMin: 300 }]);
    expect(JSON.stringify(p)).not.toContain(userId);
  });
});
