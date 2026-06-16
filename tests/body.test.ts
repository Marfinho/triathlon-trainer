import { describe, it, expect } from "vitest";
import { summarizeBody, type BodyEntry } from "@/domain/training/body";

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
});
