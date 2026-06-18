import { describe, it, expect } from "vitest";
import {
  intensityDistribution,
  estimateCalories,
  efficiencyTrend,
  sportBalance,
  buildMonthlyVolume,
  bestPaceBySport,
  rpeToBand,
  type AnalyticsActivity,
} from "@/domain/training/analytics";

function act(o: Partial<AnalyticsActivity>): AnalyticsActivity {
  return {
    date: "2026-06-01",
    sport: "run",
    durationMin: 60,
    distanceKm: 10,
    load: 60,
    rpe: 4,
    avgHr: 140,
    avgPower: null,
    ...o,
  };
}

describe("rpeToBand", () => {
  it("ordnet RPE den Bändern zu", () => {
    expect(rpeToBand(2)).toBe("easy");
    expect(rpeToBand(4)).toBe("easy");
    expect(rpeToBand(5)).toBe("moderate");
    expect(rpeToBand(6)).toBe("moderate");
    expect(rpeToBand(7)).toBe("hard");
    expect(rpeToBand(10)).toBe("hard");
  });
});

describe("intensityDistribution", () => {
  it("erkennt ein polarisiertes Muster (viel easy, etwas hard)", () => {
    const acts = [
      ...Array.from({ length: 8 }, () => act({ rpe: 3, durationMin: 60 })),
      ...Array.from({ length: 2 }, () => act({ rpe: 9, durationMin: 30 })),
    ];
    const d = intensityDistribution(acts);
    expect(d.easyPct).toBeGreaterThanOrEqual(75);
    expect(d.hardPct).toBeGreaterThanOrEqual(10);
    expect(d.model).toBe("polarisiert");
  });

  it("ignoriert Einheiten ohne RPE/Dauer und liefert unklar bei zu wenig Daten", () => {
    const d = intensityDistribution([act({ rpe: null }), act({ durationMin: null })]);
    expect(d.sampleCount).toBe(0);
    expect(d.model).toBe("unklar");
  });
});

describe("estimateCalories", () => {
  it("nutzt Power, wenn vorhanden (kJ ≈ kcal)", () => {
    // 200 W über 60 min = 200*3600/1000 = 720 kJ
    expect(estimateCalories(act({ avgPower: 200, durationMin: 60 }), 70)).toBe(720);
  });

  it("fällt auf MET·kg·h zurück ohne Power", () => {
    // run MET 9.8 * 70 kg * 1 h = 686
    expect(estimateCalories(act({ avgPower: null, durationMin: 60, sport: "run" }), 70)).toBe(686);
  });

  it("liefert null ohne Gewicht und ohne Power", () => {
    expect(estimateCalories(act({ avgPower: null }), null)).toBeNull();
  });
});

describe("efficiencyTrend", () => {
  it("berechnet Power/HF und sortiert chronologisch", () => {
    const pts = efficiencyTrend([
      act({ date: "2026-06-02", avgPower: 200, avgHr: 140 }),
      act({ date: "2026-06-01", avgPower: 190, avgHr: 140 }),
    ]);
    expect(pts.map((p) => p.date)).toEqual(["2026-06-01", "2026-06-02"]);
    expect(pts[1].ef).toBeCloseTo(200 / 140, 2);
  });

  it("nutzt Geschwindigkeit/HF ohne Power", () => {
    const pts = efficiencyTrend([act({ avgPower: null, distanceKm: 10, durationMin: 60, avgHr: 150 })]);
    expect(pts).toHaveLength(1);
    expect(pts[0].ef).toBeGreaterThan(0);
  });
});

describe("sportBalance", () => {
  it("warnt bei vernachlässigter Disziplin", () => {
    const b = sportBalance([
      act({ sport: "bike", durationMin: 300 }),
      act({ sport: "run", durationMin: 200 }),
      act({ sport: "swim", durationMin: 10 }),
    ]);
    expect(b.warning).toMatch(/Schwimmen/);
    expect(b.shares[0].sport).toBe("bike");
  });

  it("keine Warnung bei ausgewogenem Training", () => {
    const b = sportBalance([
      act({ sport: "bike", durationMin: 100 }),
      act({ sport: "run", durationMin: 100 }),
      act({ sport: "swim", durationMin: 100 }),
    ]);
    expect(b.warning).toBeNull();
  });
});

describe("buildMonthlyVolume", () => {
  it("aggregiert je Monat", () => {
    const v = buildMonthlyVolume([
      act({ date: "2026-05-15", durationMin: 60, distanceKm: 10 }),
      act({ date: "2026-06-01", durationMin: 120, distanceKm: 20 }),
      act({ date: "2026-06-20", durationMin: 60, distanceKm: 10 }),
    ]);
    expect(v.map((m) => m.month)).toEqual(["2026-05", "2026-06"]);
    expect(v[1].sessions).toBe(2);
    expect(v[1].km).toBe(30);
  });
});

describe("bestPaceBySport", () => {
  it("findet die schnellste Pace je Sportart", () => {
    const b = bestPaceBySport([
      act({ sport: "run", distanceKm: 10, durationMin: 50 }), // 300 s/km
      act({ sport: "run", distanceKm: 10, durationMin: 45 }), // 270 s/km
    ]);
    expect(b).toHaveLength(1);
    expect(b[0].secPerKm).toBe(270);
  });

  it("ignoriert sehr kurze Einheiten", () => {
    expect(bestPaceBySport([act({ distanceKm: 0.5, durationMin: 2 })])).toHaveLength(0);
  });
});
