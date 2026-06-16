import { describe, it, expect } from "vitest";
import {
  cssFromTimeTrials,
  paceToSpeed,
  speedToPace,
  parseClock,
  formatClock,
} from "@/domain/training/calculators";

describe("cssFromTimeTrials", () => {
  it("berechnet CSS-Pace je 100 m", () => {
    // 400 m in 6:00 (360s), 200 m in 2:50 (170s) -> (360-170)/2 = 95 s/100m
    expect(cssFromTimeTrials(360, 170)).toBe(95);
  });
  it("ist null bei unplausiblen Zeiten", () => {
    expect(cssFromTimeTrials(170, 360)).toBeNull();
  });
});

describe("pace/speed", () => {
  it("rechnet Pace <-> Geschwindigkeit", () => {
    expect(paceToSpeed(300)).toBe(12); // 5:00/km = 12 km/h
    expect(speedToPace(12)).toBe(300);
  });
});

describe("parse/format clock", () => {
  it("parst verschiedene Formate", () => {
    expect(parseClock("6:00")).toBe(360);
    expect(parseClock("1:30:00")).toBe(5400);
    expect(parseClock("abc")).toBeNull();
  });
  it("formatiert m:ss", () => {
    expect(formatClock(95)).toBe("1:35");
  });
});
