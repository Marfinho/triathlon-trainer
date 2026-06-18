import { describe, it, expect } from "vitest";
import {
  weeklyRampRate,
  consistencyScore,
  recommendTraining,
} from "@/domain/training/loadAdvisor";

describe("weeklyRampRate", () => {
  it("berechnet Wochensummen und Steigerungsrate", () => {
    const r = weeklyRampRate([
      { date: "2026-06-01", load: 100 }, // Mo KW
      { date: "2026-06-08", load: 130 }, // Folgewoche
    ]);
    expect(r.weeks).toHaveLength(2);
    expect(r.weeks[1].ratio).toBe(1.3);
    expect(r.latestRatio).toBe(1.3);
  });

  it("flaggt riskante Sprünge >1.5", () => {
    const r = weeklyRampRate([
      { date: "2026-06-01", load: 100 },
      { date: "2026-06-08", load: 200 },
    ]);
    expect(r.risk).toBe("high");
  });

  it("ist ok bei moderater Steigerung", () => {
    const r = weeklyRampRate([
      { date: "2026-06-01", load: 100 },
      { date: "2026-06-08", load: 110 },
    ]);
    expect(r.risk).toBe("low");
  });
});

describe("consistencyScore", () => {
  it("berechnet den Prozentsatz erledigter Workouts", () => {
    expect(consistencyScore({ plannedCount: 10, completedCount: 9 })).toEqual({
      score: 90,
      label: "exzellent",
    });
  });

  it("liefert keine Daten ohne Plan", () => {
    expect(consistencyScore({ plannedCount: 0, completedCount: 0 }).label).toBe("keine Daten");
  });

  it("deckelt completed auf planned", () => {
    expect(consistencyScore({ plannedCount: 5, completedCount: 8 }).score).toBe(100);
  });
});

describe("recommendTraining", () => {
  it("priorisiert ACWR-Risiko (Erholung)", () => {
    expect(recommendTraining(20, 1.6).level).toBe("recover");
  });

  it("empfiehlt harte Reize bei hoher Frische", () => {
    expect(recommendTraining(20, 1.0).level).toBe("go_hard");
  });

  it("empfiehlt Erholung bei stark negativer Form", () => {
    expect(recommendTraining(-30, 1.0).level).toBe("recover");
  });

  it("ist steady ohne TSB-Daten", () => {
    expect(recommendTraining(null, null).level).toBe("steady");
  });
});
