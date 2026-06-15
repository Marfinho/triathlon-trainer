import { describe, it, expect } from "vitest";
import {
  daysUntilRace,
  describeCountdown,
  racePosition,
} from "@/domain/training/races";

const today = new Date("2026-06-15T08:00:00Z");

describe("daysUntilRace", () => {
  it("zählt Tage bis zum Rennen", () => {
    expect(daysUntilRace("2026-06-15", today)).toBe(0);
    expect(daysUntilRace("2026-06-22", today)).toBe(7);
    expect(daysUntilRace("2026-06-10", today)).toBe(-5);
  });
});

describe("describeCountdown", () => {
  it("formuliert den Countdown", () => {
    expect(describeCountdown(0)).toBe("heute");
    expect(describeCountdown(1)).toBe("morgen");
    expect(describeCountdown(5)).toBe("in 5 Tagen");
    expect(describeCountdown(28)).toBe("in 4 Wochen");
    expect(describeCountdown(-3)).toBe("vor 3 Tagen");
  });
});

describe("racePosition", () => {
  it("positioniert innerhalb des Horizonts", () => {
    expect(racePosition(90, 180).fraction).toBeCloseTo(0.5);
    expect(racePosition(90, 180).withinHorizon).toBe(true);
  });
  it("markiert außerhalb des Horizonts", () => {
    expect(racePosition(-1, 180).withinHorizon).toBe(false);
    expect(racePosition(400, 180).withinHorizon).toBe(false);
  });
});
