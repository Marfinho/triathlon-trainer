import { describe, it, expect } from "vitest";
import {
  PLAN_LIMITS,
  getLimits,
  hasFeature,
  allowsPredictionSport,
} from "@/lib/plan-limits";

describe("PLAN_LIMITS", () => {
  it("free entspricht der Spezifikation", () => {
    const free = PLAN_LIMITS.free;
    expect(free.planHorizonDays).toBe(28);
    expect(free.maxRaceEvents).toBe(3);
    expect(free.maxPlanImportsPerMonth).toBe(2);
    expect(free.maxGearItems).toBe(5);
    expect(free.maxGearComponents).toBe(2);
    expect(free.maxActiveIntegrations).toBe(1);
    expect(free.activityHistoryDays).toBe(90);
    expect(free.syncIntervalMinutes).toBe(1440);
    expect(free.pmcHorizonDays).toBe(56);
    expect(free.allowedPredictionSports).toEqual(["run"]);
    expect(free.weeklyReport).toBe(false);
    expect(free.manualBackupCooldownHours).toBe(168);
  });

  it("paid entspricht der Spezifikation", () => {
    const paid = PLAN_LIMITS.paid;
    expect(Number.isFinite(paid.planHorizonDays)).toBe(false);
    expect(Number.isFinite(paid.maxRaceEvents)).toBe(false);
    expect(Number.isFinite(paid.maxPlanImportsPerMonth)).toBe(false);
    expect(Number.isFinite(paid.maxGearItems)).toBe(false);
    expect(Number.isFinite(paid.maxGearComponents)).toBe(false);
    expect(Number.isFinite(paid.maxActiveIntegrations)).toBe(false);
    expect(Number.isFinite(paid.activityHistoryDays)).toBe(false);
    expect(Number.isFinite(paid.pmcHorizonDays)).toBe(false);
    expect(paid.syncIntervalMinutes).toBe(30);
    expect(paid.allowedPredictionSports).toContain("bike");
    expect(paid.allowedPredictionSports).toContain("swim");
    expect(paid.allowedPredictionSports).toContain("triathlon");
    expect(paid.weeklyReport).toBe(true);
    expect(paid.manualBackupCooldownHours).toBe(0);
  });
});

describe("getLimits", () => {
  it("liefert die jeweiligen Tiers", () => {
    expect(getLimits("free")).toBe(PLAN_LIMITS.free);
    expect(getLimits("paid")).toBe(PLAN_LIMITS.paid);
  });

  it("fällt bei unbekanntem Plan auf free zurück", () => {
    expect(getLimits("nonsense")).toBe(PLAN_LIMITS.free);
  });
});

describe("hasFeature", () => {
  it("schaltet weeklyReport nur für paid frei", () => {
    expect(hasFeature("paid", "weeklyReport")).toBe(true);
    expect(hasFeature("free", "weeklyReport")).toBe(false);
  });
});

describe("allowsPredictionSport", () => {
  it("erlaubt bike nur für paid", () => {
    expect(allowsPredictionSport("free", "bike")).toBe(false);
    expect(allowsPredictionSport("paid", "bike")).toBe(true);
  });
});
