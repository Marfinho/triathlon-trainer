import { describe, it, expect } from "vitest";
import {
  estimateActivityLoad,
  buildLoadSeries,
  buildWeeklyVolume,
  interpretForm,
  type LoadActivity,
} from "@/domain/training/trainingLoad";

const today = new Date("2026-06-15T00:00:00Z");

describe("estimateActivityLoad", () => {
  it("nutzt die gemessene Last, wenn vorhanden", () => {
    expect(
      estimateActivityLoad({ date: "2026-06-10", sport: "bike", durationMin: 60, load: 88 }),
    ).toBe(88);
  });

  it("schätzt aus Dauer und RPE, wenn keine Last vorhanden", () => {
    const l = estimateActivityLoad({
      date: "2026-06-10",
      sport: "run",
      durationMin: 60,
      load: null,
      rpe: 7,
    });
    expect(l).toBeGreaterThan(60);
    expect(l).toBeLessThan(110);
  });

  it("ist 0 ohne Dauer", () => {
    expect(
      estimateActivityLoad({ date: "x", sport: "run", durationMin: 0, load: null }),
    ).toBe(0);
  });
});

describe("buildLoadSeries", () => {
  it("liefert eine Serie der gewünschten Länge mit aktuellem Stand", () => {
    const series = buildLoadSeries([], { days: 30, today });
    expect(series.dates).toHaveLength(30);
    expect(series.ctl).toHaveLength(30);
    expect(series.current.ctl).toBe(0);
    expect(series.current.tsb).toBe(0);
  });

  it("CTL steigt durch Trainingslast, ATL reagiert schneller", () => {
    const activities: LoadActivity[] = Array.from({ length: 20 }, (_, i) => ({
      date: new Date(today.getTime() - i * 86400000),
      sport: "bike",
      durationMin: 60,
      load: 80,
    }));
    const series = buildLoadSeries(activities, { days: 30, today });
    expect(series.current.ctl).toBeGreaterThan(0);
    // ATL (7d) reagiert schneller als CTL (42d) -> höher bei frischer Last.
    expect(series.current.atl).toBeGreaterThan(series.current.ctl);
    // Form (TSB) negativ bei akuter Belastung.
    expect(series.current.tsb).toBeLessThan(0);
  });
});

describe("buildWeeklyVolume", () => {
  it("summiert Minuten je Disziplin pro Woche", () => {
    const activities: LoadActivity[] = [
      { date: "2026-06-15", sport: "bike", durationMin: 90, load: null },
      { date: "2026-06-15", sport: "run", durationMin: 40, load: null },
      { date: "2026-06-14", sport: "swim", durationMin: 45, load: null },
    ];
    const weeks = buildWeeklyVolume(activities, { weeks: 4, today });
    expect(weeks).toHaveLength(4);
    const last = weeks[weeks.length - 1];
    expect(last.bySport.bike).toBe(90);
    expect(last.bySport.run).toBe(40);
    expect(last.totalMin).toBe(130);
  });
});

describe("interpretForm", () => {
  it("klassifiziert Form anhand TSB", () => {
    expect(interpretForm(20).state).toBe("fresh");
    expect(interpretForm(8).state).toBe("optimal");
    expect(interpretForm(0).state).toBe("neutral");
    expect(interpretForm(-15).state).toBe("tired");
    expect(interpretForm(-30).state).toBe("overload");
  });
});
