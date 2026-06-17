import { describe, it, expect } from "vitest";
import {
  mergeLimits,
  defaultLimits,
  sanitizeOverride,
  toJsonSafeLimits,
  knownTiers,
} from "@/lib/plan-config";

describe("defaultLimits", () => {
  it("liefert die PLAN_LIMITS-Defaults als reines Objekt mit Infinity", () => {
    const free = defaultLimits("free");
    expect(free.planHorizonDays).toBe(28);
    expect(free.allowedPredictionSports).toEqual(["run"]);
    const paid = defaultLimits("paid");
    expect(paid.planHorizonDays).toBe(Infinity);
    expect(paid.weeklyReport).toBe(true);
  });

  it("fällt bei unbekanntem Tier auf free zurück", () => {
    expect(defaultLimits("xxx").planHorizonDays).toBe(28);
  });
});

describe("mergeLimits", () => {
  it("gibt unveränderte Defaults zurück, wenn kein Override vorliegt", () => {
    const base = defaultLimits("free");
    const merged = mergeLimits(base, null);
    expect(merged).toEqual(base);
    // Kopie, kein geteiltes Array
    merged.allowedPredictionSports.push("bike");
    expect(base.allowedPredictionSports).toEqual(["run"]);
  });

  it("überschreibt numerische Felder", () => {
    const merged = mergeLimits(defaultLimits("free"), { maxRaceEvents: 10 });
    expect(merged.maxRaceEvents).toBe(10);
  });

  it("interpretiert null als unbegrenzt (Infinity)", () => {
    const merged = mergeLimits(defaultLimits("free"), { maxGearItems: null });
    expect(merged.maxGearItems).toBe(Infinity);
  });

  it("überschreibt allowedPredictionSports und weeklyReport", () => {
    const merged = mergeLimits(defaultLimits("free"), {
      allowedPredictionSports: ["run", "bike"],
      weeklyReport: true,
    });
    expect(merged.allowedPredictionSports).toEqual(["run", "bike"]);
    expect(merged.weeklyReport).toBe(true);
  });

  it("ignoriert ungültige/teilweise Werte", () => {
    const base = defaultLimits("free");
    const merged = mergeLimits(base, {
      // @ts-expect-error – absichtlich ungültiger Typ
      maxRaceEvents: "viele",
    });
    expect(merged.maxRaceEvents).toBe(base.maxRaceEvents);
  });

  it("kann ein Paid-ähnliches Free-Tier erzeugen", () => {
    const merged = mergeLimits(defaultLimits("free"), {
      maxRaceEvents: null,
      weeklyReport: true,
      allowedPredictionSports: ["run", "bike", "swim", "triathlon"],
    });
    expect(merged.maxRaceEvents).toBe(Infinity);
    expect(merged.weeklyReport).toBe(true);
    expect(merged.allowedPredictionSports).toHaveLength(4);
  });
});

describe("sanitizeOverride", () => {
  it("behält nur bekannte Felder mit gültigen Typen", () => {
    const clean = sanitizeOverride({
      maxRaceEvents: 5,
      maxGearItems: null,
      weeklyReport: true,
      allowedPredictionSports: ["run", "bike"],
      // @ts-expect-error – unbekanntes Feld
      hackerField: 9000,
    });
    expect(clean.maxRaceEvents).toBe(5);
    expect(clean.maxGearItems).toBe(null);
    expect(clean.weeklyReport).toBe(true);
    expect(clean.allowedPredictionSports).toEqual(["run", "bike"]);
    expect("hackerField" in clean).toBe(false);
  });

  it("verwirft negative Zahlen", () => {
    const clean = sanitizeOverride({ maxRaceEvents: -3 });
    expect("maxRaceEvents" in clean).toBe(false);
  });
});

describe("toJsonSafeLimits", () => {
  it("wandelt Infinity in null", () => {
    const safe = toJsonSafeLimits(defaultLimits("paid"));
    expect(safe.planHorizonDays).toBe(null);
    expect(safe.weeklyReport).toBe(true);
    expect(safe.syncIntervalMinutes).toBe(30);
  });

  it("lässt endliche Werte unverändert", () => {
    const safe = toJsonSafeLimits(defaultLimits("free"));
    expect(safe.planHorizonDays).toBe(28);
    expect(safe.allowedPredictionSports).toEqual(["run"]);
  });
});

describe("knownTiers", () => {
  it("enthält free und paid", () => {
    expect(knownTiers()).toEqual(expect.arrayContaining(["free", "paid"]));
  });
});
