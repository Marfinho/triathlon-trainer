import { describe, it, expect } from "vitest";
import { buildFuelingHints } from "@/domain/nutrition/heuristics";
import type { DailyBalanceResult } from "@/domain/nutrition/dailyBalance";
import type { DailyEnergyForecast } from "@/domain/nutrition/forecast";

function balance(status: DailyBalanceResult["status"]): DailyBalanceResult {
  return { intakeKcal: 0, burnedKcal: 0, netKcal: 0, targetKcal: null, deltaToTargetKcal: null, status };
}

describe("buildFuelingHints", () => {
  it("warnt bei Unterversorgung", () => {
    const hints = buildFuelingHints(balance("underfueled"), []);
    expect(hints.some((h) => h.level === "notice")).toBe(true);
  });

  it("informiert bei Überschuss ohne Warnung", () => {
    const hints = buildFuelingHints(balance("surplus"), []);
    expect(hints).toHaveLength(1);
    expect(hints[0].level).toBe("info");
  });

  it("gibt keinen Bilanz-Hinweis bei 'ok' oder 'unknown'", () => {
    expect(buildFuelingHints(balance("ok"), [])).toHaveLength(0);
    expect(buildFuelingHints(balance("unknown"), [])).toHaveLength(0);
  });

  it("weist auf eine kommende energieintensive Einheit hin", () => {
    const forecast: DailyEnergyForecast[] = [
      { date: "2026-06-24", kcal: 800, confidence: "medium", workoutCount: 1 },
    ];
    const hints = buildFuelingHints(balance("ok"), forecast);
    expect(hints).toHaveLength(1);
    expect(hints[0].text).toContain("2026-06-24");
    expect(hints[0].text).toContain("800");
  });

  it("ignoriert Einheiten unter 600 kcal", () => {
    const forecast: DailyEnergyForecast[] = [
      { date: "2026-06-24", kcal: 400, confidence: "medium", workoutCount: 1 },
    ];
    expect(buildFuelingHints(balance("ok"), forecast)).toHaveLength(0);
  });

  it("kombiniert Bilanz- und Forecast-Hinweise", () => {
    const forecast: DailyEnergyForecast[] = [
      { date: "2026-06-24", kcal: 700, confidence: "high", workoutCount: 1 },
    ];
    const hints = buildFuelingHints(balance("underfueled"), forecast);
    expect(hints).toHaveLength(2);
  });
});
