import { describe, it, expect } from "vitest";
import {
  computeGearUsage,
  type GearUsageActivity,
} from "@/domain/training/gear";

const activities: GearUsageActivity[] = [
  { date: "2026-06-01", sport: "run", distanceKm: 10, durationMin: 55 },
  { date: "2026-06-05", sport: "run", distanceKm: 15, durationMin: 80 },
  { date: "2026-06-05", sport: "bike", distanceKm: 40, durationMin: 90 },
  { date: "2026-05-01", sport: "run", distanceKm: 8, durationMin: 45 },
];

describe("computeGearUsage", () => {
  it("akkumuliert passende Sport-Aktivitäten ab dem Kaufdatum", () => {
    const u = computeGearUsage(
      {
        sport: "run",
        purchaseDate: "2026-05-15",
        autoTrack: true,
        manualKm: 0,
        manualHours: 0,
      },
      activities,
    );
    // 10 + 15 km (08 am 01.05 liegt vor Kaufdatum)
    expect(u.km).toBe(25);
    expect(u.hours).toBeCloseTo((55 + 80) / 60, 1);
  });

  it("addiert manuelle Werte", () => {
    const u = computeGearUsage(
      { sport: "run", autoTrack: true, manualKm: 100, manualHours: 5 },
      activities,
    );
    expect(u.km).toBe(100 + 33);
  });

  it("zählt nur die eigene Sportart", () => {
    const u = computeGearUsage(
      { sport: "bike", autoTrack: true, manualKm: 0, manualHours: 0 },
      activities,
    );
    expect(u.km).toBe(40);
  });

  it("ignoriert Aktivitäten ohne autoTrack", () => {
    const u = computeGearUsage(
      { sport: "run", autoTrack: false, manualKm: 12, manualHours: 1 },
      activities,
    );
    expect(u.km).toBe(12);
  });

  it("setzt Wear-Status anhand der Grenzwerte", () => {
    const base = { sport: "run" as const, autoTrack: false, manualHours: 0 };
    expect(computeGearUsage({ ...base, manualKm: 400, alertKm: 800 }, []).status).toBe("ok");
    expect(computeGearUsage({ ...base, manualKm: 700, alertKm: 800 }, []).status).toBe("due");
    expect(computeGearUsage({ ...base, manualKm: 850, alertKm: 800 }, []).status).toBe("over");
  });

  it("nimmt den schlechtesten Status aus km und Stunden", () => {
    const u = computeGearUsage(
      {
        sport: "run",
        autoTrack: false,
        manualKm: 100,
        manualHours: 95,
        alertKm: 800,
        alertHours: 100,
      },
      [],
    );
    expect(u.status).toBe("due"); // Stunden bei 95 % -> due
  });
});
