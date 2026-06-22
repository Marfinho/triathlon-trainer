import { describe, it, expect } from "vitest";
import {
  forecastWorkoutEnergy,
  forecastEnergyBurn,
  aggregateForecastByDay,
} from "@/domain/nutrition/forecast";

describe("forecastWorkoutEnergy", () => {
  it("liefert null für eine Einheit ohne Dauer", () => {
    const result = forecastWorkoutEnergy(
      { date: "2026-06-23", sport: "bike", plannedDurationMin: 0 },
      { ftpWatts: 250, weightKg: 70 },
    );
    expect(result).toBeNull();
  });

  it("nutzt Power-Segmente mit hoher Konfidenz, wenn vorhanden", () => {
    const result = forecastWorkoutEnergy(
      {
        date: "2026-06-23",
        sport: "bike",
        plannedDurationMin: 60,
        segments: [{ type: "work", durationSec: 3600, targetType: "power", targetValue: 200 }],
      },
      { ftpWatts: 250, weightKg: 70 },
    );
    expect(result?.source).toBe("estimated_power");
    expect(result?.confidence).toBe("high");
    expect(result?.kcal).toBeGreaterThan(0);
  });

  it("fällt auf Dauer+Gewicht zurück, wenn keine Power-Segmente vorliegen", () => {
    const result = forecastWorkoutEnergy(
      { date: "2026-06-23", sport: "run", plannedDurationMin: 60 },
      { ftpWatts: 250, weightKg: 70 },
    );
    expect(result?.source).toBe("estimated_duration_weight");
    expect(result?.confidence).toBe("medium");
    expect(result?.kcal).toBeGreaterThan(0);
  });

  it("fällt auf historische Werte zurück, wenn Gewicht fehlt", () => {
    const result = forecastWorkoutEnergy(
      { date: "2026-06-23", sport: "run", plannedDurationMin: 60 },
      { ftpWatts: 0, weightKg: null, historyAvgKcalPerMinBySport: { run: 10 } },
    );
    expect(result?.source).toBe("estimated_history_based");
    expect(result?.confidence).toBe("low");
    expect(result?.kcal).toBe(600);
  });

  it("liefert null, wenn keine Schätzgrundlage existiert", () => {
    const result = forecastWorkoutEnergy(
      { date: "2026-06-23", sport: "run", plannedDurationMin: 60 },
      { ftpWatts: 0, weightKg: null },
    );
    expect(result).toBeNull();
  });
});

describe("forecastEnergyBurn / aggregateForecastByDay", () => {
  it("aggregiert mehrere Einheiten desselben Tages und nimmt die konservativste Konfidenz", () => {
    const forecasts = forecastEnergyBurn(
      [
        { date: "2026-06-23", sport: "run", plannedDurationMin: 60 },
        {
          date: "2026-06-23",
          sport: "bike",
          plannedDurationMin: 30,
          segments: [{ type: "work", durationSec: 1800, targetType: "power", targetValue: 200 }],
        },
      ],
      { ftpWatts: 250, weightKg: 70 },
    );
    const byDay = aggregateForecastByDay(forecasts);
    expect(byDay).toHaveLength(1);
    expect(byDay[0].workoutCount).toBe(2);
    expect(byDay[0].confidence).toBe("medium"); // niedrigste der beiden (medium < high)
    expect(byDay[0].kcal).toBe(forecasts[0].kcal + forecasts[1].kcal);
  });

  it("sortiert die Tage chronologisch", () => {
    const forecasts = forecastEnergyBurn(
      [
        { date: "2026-06-25", sport: "run", plannedDurationMin: 60 },
        { date: "2026-06-23", sport: "run", plannedDurationMin: 60 },
      ],
      { ftpWatts: 250, weightKg: 70 },
    );
    const byDay = aggregateForecastByDay(forecasts);
    expect(byDay.map((d) => d.date)).toEqual(["2026-06-23", "2026-06-25"]);
  });
});
