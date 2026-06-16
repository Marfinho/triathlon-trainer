import { describe, it, expect } from "vitest";
import { buildSeasonStats, type StatActivity } from "@/domain/training/stats";
import { computeSwimZones } from "@/domain/training/zones";

const today = new Date("2026-06-16T00:00:00Z");

describe("buildSeasonStats", () => {
  const activities: StatActivity[] = [
    { date: "2026-06-16", sport: "run", durationMin: 60, distanceKm: 12, load: 70 },
    { date: "2026-06-15", sport: "bike", durationMin: 120, distanceKm: 50, load: 110 },
    { date: "2026-06-15", sport: "run", durationMin: 40, distanceKm: 8, load: 45 },
    { date: "2026-06-10", sport: "swim", durationMin: 45, distanceKm: 2.2, load: 40 },
  ];

  it("aggregiert Gesamtwerte", () => {
    const s = buildSeasonStats(activities, { today });
    expect(s.totalSessions).toBe(4);
    expect(s.totalHours).toBeCloseTo((60 + 120 + 40 + 45) / 60, 1);
    expect(s.totalKm).toBe(Math.round(12 + 50 + 8 + 2.2));
  });

  it("ermittelt Bestwerte je Disziplin", () => {
    const s = buildSeasonStats(activities, { today });
    const run = s.bySport.find((x) => x.sport === "run")!;
    expect(run.sessions).toBe(2);
    expect(run.longestMin).toBe(60);
    expect(run.farthestKm).toBe(12);
    const bike = s.bySport.find((x) => x.sport === "bike")!;
    expect(bike.highestLoad).toBe(110);
  });

  it("berechnet den aktuellen Streak (heute + gestern = 2)", () => {
    const s = buildSeasonStats(activities, { today });
    expect(s.currentStreakDays).toBe(2); // 16. + 15., am 14. nichts
  });

  it("findet die größte Trainingswoche nach Load", () => {
    const s = buildSeasonStats(activities, { today });
    expect(s.biggestWeekLoad).toBeGreaterThanOrEqual(110);
  });
});

describe("computeSwimZones", () => {
  it("CSS-Zone (Z3) umschließt die Schwellen-Pace", () => {
    const z = computeSwimZones(95); // 1:35 /100m
    const z3 = z.find((x) => x.id === "z3")!;
    expect((z3.lo ?? 0)).toBeLessThan(95);
    expect((z3.hi ?? 0)).toBeGreaterThan(95);
  });
});
