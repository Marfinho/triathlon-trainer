import { describe, it, expect } from "vitest";
import { buildWeeklyReport } from "@/domain/training/report";

describe("buildWeeklyReport", () => {
  const md = buildWeeklyReport({
    weekStart: "2026-06-15",
    form: { ctl: 70, atl: 80, tsb: -10 },
    bySport: [
      { sport: "bike", min: 180, km: 60, sessions: 2 },
      { sport: "run", min: 90, km: 16, sessions: 1 },
    ],
    compliancePct: 75,
    goals: [{ sport: "bike", actualMin: 180, targetMin: 300 }],
  });

  it("enthält Titel, Umfang und Form", () => {
    expect(md).toContain("# Wochenbericht ab 2026-06-15");
    expect(md).toContain("4.5 h");
    expect(md).toContain("Compliance:** 75 %");
    expect(md).toContain("Fitness 70");
  });

  it("listet Disziplinen als Tabelle und Ziele", () => {
    expect(md).toContain("| Rad | 2 | 3.0 h | 60 km |");
    expect(md).toContain("Rad: 3.0 / 5.0 h (60 %)");
  });

  it("kommt mit leerer Woche klar", () => {
    const empty = buildWeeklyReport({
      weekStart: "2026-06-15",
      form: { ctl: 0, atl: 0, tsb: 0 },
      bySport: [],
      compliancePct: null,
      goals: [],
    });
    expect(empty).toContain("_keine Aktivitäten_");
  });
});
