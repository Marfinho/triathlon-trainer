import { describe, it, expect } from "vitest";
import { getLimits, type PlanLimits } from "@/lib/plan-limits";

/** Numerische Limit-Schlüssel, deren Überschreitung ein HARD-GATE auslöst. */
type NumericLimitKey = {
  [K in keyof PlanLimits]: PlanLimits[K] extends number ? K : never;
}[keyof PlanLimits];

/**
 * Reine HARD-GATE-Entscheidung: Ist das Limit erreicht? Unbegrenzte (Infinity)
 * Limits blocken nie.
 */
function reached(plan: string, current: number, key: NumericLimitKey): boolean {
  const limit = getLimits(plan)[key];
  return Number.isFinite(limit) && current >= limit;
}

describe("HARD-GATE: maxRaceEvents", () => {
  it("blockt free bei erreichtem Limit (current=3)", () => {
    expect(reached("free", 3, "maxRaceEvents")).toBe(true);
  });

  it("blockt free noch nicht darunter (current=2)", () => {
    expect(reached("free", 2, "maxRaceEvents")).toBe(false);
  });

  it("blockt paid nie", () => {
    expect(reached("paid", 9999, "maxRaceEvents")).toBe(false);
  });
});

describe("HARD-GATE: maxGearItems", () => {
  it("blockt free bei erreichtem Limit (current=5)", () => {
    expect(reached("free", 5, "maxGearItems")).toBe(true);
  });

  it("blockt free noch nicht darunter (current=4)", () => {
    expect(reached("free", 4, "maxGearItems")).toBe(false);
  });

  it("blockt paid nie", () => {
    expect(reached("paid", 9999, "maxGearItems")).toBe(false);
  });
});
