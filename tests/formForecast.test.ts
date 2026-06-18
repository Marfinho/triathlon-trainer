import { describe, it, expect } from "vitest";
import { forecastForm, type PlannedLoadDay } from "@/domain/training/formForecast";

/** Erzeugt Plandaten mit konstanter Tageslast über N Tage ab Startdatum. */
function constantLoad(startIso: string, days: number, load: number): PlannedLoadDay[] {
  const out: PlannedLoadDay[] = [];
  const start = new Date(`${startIso}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    out.push({ date: d.toISOString().slice(0, 10), load });
  }
  return out;
}

describe("forecastForm", () => {
  it("projiziert die Form bis zum Renntag", () => {
    const f = forecastForm({
      startCtl: 60,
      startAtl: 60,
      startDate: "2026-06-01",
      raceDate: "2026-06-14",
      plannedLoads: constantLoad("2026-06-01", 20, 30),
    });
    expect(f.raceDay).not.toBeNull();
    expect(f.raceDay!.date).toBe("2026-06-14");
    expect(f.series.length).toBeGreaterThan(0);
  });

  it("erkennt einen optimalen Taper (ruhige letzte Woche → positiver TSB)", () => {
    // Hohe Fitness, dann sehr geringe Last → TSB steigt in den optimalen Bereich.
    const loads = [
      ...constantLoad("2026-06-01", 3, 20),
      ...constantLoad("2026-06-04", 11, 5),
    ];
    const f = forecastForm({
      startCtl: 70,
      startAtl: 70,
      startDate: "2026-06-01",
      raceDate: "2026-06-14",
      plannedLoads: loads,
    });
    expect(f.raceDay!.tsb).toBeGreaterThan(0);
    expect(["optimal", "zu_frisch"]).toContain(f.verdict);
  });

  it("warnt, wenn der Athlet zu müde ins Rennen geht", () => {
    const f = forecastForm({
      startCtl: 60,
      startAtl: 60,
      startDate: "2026-06-01",
      raceDate: "2026-06-14",
      plannedLoads: constantLoad("2026-06-01", 20, 120), // dauerhaft hohe Last
    });
    expect(f.raceDay!.tsb).toBeLessThan(-5);
    expect(f.verdict).toBe("zu_muede");
  });

  it("liefert kein_renntag, wenn das Renndatum außerhalb liegt", () => {
    const f = forecastForm({
      startCtl: 50,
      startAtl: 50,
      startDate: "2026-06-01",
      raceDate: null,
      plannedLoads: constantLoad("2026-06-01", 5, 30),
    });
    expect(f.verdict).toBe("kein_renntag");
    expect(f.raceDay).toBeNull();
  });
});
