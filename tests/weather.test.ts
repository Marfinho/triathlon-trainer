import { describe, it, expect } from "vitest";
import { pickForecastForDate, describeForecast, type OpenMeteoDaily } from "@/domain/training/weather";

const daily: OpenMeteoDaily = {
  time: ["2026-06-17", "2026-06-18", "2026-06-19"],
  temperature_2m_max: [22, 25, 19],
  temperature_2m_min: [12, 14, 10],
  precipitation_sum: [0, 4.2, 0.1],
  windspeed_10m_max: [10, 32, 8],
};

describe("pickForecastForDate", () => {
  it("findet den passenden Tag", () => {
    expect(pickForecastForDate(daily, "2026-06-18")).toEqual({
      date: "2026-06-18",
      tempMaxC: 25,
      tempMinC: 14,
      precipitationMm: 4.2,
      windMaxKmh: 32,
    });
  });

  it("liefert null außerhalb des Prognosehorizonts", () => {
    expect(pickForecastForDate(daily, "2026-07-01")).toBeNull();
  });
});

describe("describeForecast", () => {
  it("beschreibt trockene Tage", () => {
    const f = pickForecastForDate(daily, "2026-06-17")!;
    expect(describeForecast(f)).toBe("12–22 °C · trocken · Wind bis 10 km/h");
  });

  it("beschreibt Tage mit Niederschlag", () => {
    const f = pickForecastForDate(daily, "2026-06-18")!;
    expect(describeForecast(f)).toBe("14–25 °C · 4.2 mm Niederschlag · Wind bis 32 km/h");
  });
});

import { weatherKind } from "@/domain/training/weather";

describe("weatherKind", () => {
  it("mappt WMO-Codes", () => {
    expect(weatherKind(0)).toBe("clear");
    expect(weatherKind(2)).toBe("partly");
    expect(weatherKind(63)).toBe("rain");
    expect(weatherKind(73)).toBe("snow");
    expect(weatherKind(95)).toBe("storm");
    expect(weatherKind(undefined, 5)).toBe("rain");
  });
});
