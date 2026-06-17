import { describe, it, expect } from "vitest";
import { summarizeBody, trendLabel, type BodyEntry } from "@/domain/training/body";

describe("summarizeBody", () => {
  const entries: BodyEntry[] = [
    { date: "2026-06-10", weightKg: 76.5, restingHr: 50 },
    { date: "2026-06-14", weightKg: 76.0, restingHr: 48 },
    { date: "2026-06-12", weightKg: 76.2, restingHr: 49 },
  ];

  it("sortiert und liefert neueste Werte", () => {
    const s = summarizeBody(entries);
    expect(s.latestWeight).toBe(76.0);
    expect(s.latestRestingHr).toBe(48);
    expect(s.weights).toEqual([76.5, 76.2, 76.0]);
  });

  it("berechnet die Gewichtsänderung gegenüber dem ältesten Eintrag", () => {
    expect(summarizeBody(entries).weightChange).toBe(-0.5);
  });

  it("kommt mit fehlenden Werten klar", () => {
    const s = summarizeBody([
      { date: "2026-06-10", weightKg: null, restingHr: 52 },
      { date: "2026-06-11", weightKg: 75, restingHr: null },
    ]);
    expect(s.latestWeight).toBe(75);
    expect(s.latestRestingHr).toBe(52);
    expect(s.weightChange).toBeNull();
  });

  it("berechnet die HRV-Änderung gegenüber dem ältesten Eintrag", () => {
    const s = summarizeBody([
      { date: "2026-06-10", weightKg: null, restingHr: null, hrv: 55 },
      { date: "2026-06-14", weightKg: null, restingHr: null, hrv: 62 },
    ]);
    expect(s.latestHrv).toBe(62);
    expect(s.hrvChange).toBe(7);
  });
});

describe("trendLabel", () => {
  it("liefert null bei zu wenig Datenpunkten", () => {
    expect(trendLabel([50, 52, 51])).toBeNull();
  });

  it("erkennt einen steigenden Trend", () => {
    const vals = [50, 51, 50, 49, 60, 61, 62];
    expect(trendLabel(vals)).toBe("steigend");
  });

  it("erkennt einen fallenden Trend", () => {
    const vals = [60, 61, 62, 59, 50, 49, 48];
    expect(trendLabel(vals)).toBe("fallend");
  });

  it("erkennt einen stabilen Trend", () => {
    const vals = [55, 56, 54, 55, 56, 54, 55];
    expect(trendLabel(vals)).toBe("stabil");
  });

  it("ignoriert null/undefined-Werte in der Reihe", () => {
    const vals = [50, null, 51, 49, undefined, 60, 61, 62];
    expect(trendLabel(vals)).toBe("steigend");
  });
});
