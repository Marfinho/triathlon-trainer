/**
 * Reine Auswertung von Open-Meteo-Tagesprognosen für die Wettkampfplanung.
 * Der eigentliche HTTP-Aufruf lebt in `src/integrations/weather/openMeteo.ts`.
 */

export interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  windspeed_10m_max: number[];
  weathercode?: number[];
}

export interface DayForecast {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipitationMm: number;
  windMaxKmh: number;
  /** WMO-Wettercode (optional, nur wenn die API ihn liefert). */
  weatherCode?: number;
}

/** Sucht den Tag `dateIso` in der Open-Meteo-`daily`-Antwort (null außerhalb des Prognosehorizonts). */
export function pickForecastForDate(
  daily: OpenMeteoDaily,
  dateIso: string,
): DayForecast | null {
  const index = daily.time.indexOf(dateIso);
  if (index === -1) return null;
  return {
    date: dateIso,
    tempMaxC: daily.temperature_2m_max[index],
    tempMinC: daily.temperature_2m_min[index],
    precipitationMm: daily.precipitation_sum[index],
    windMaxKmh: daily.windspeed_10m_max[index],
    weatherCode: daily.weathercode?.[index],
  };
}

/** Kurze deutsche Zusammenfassung einer Tagesprognose für die Wettkampfplanung. */
export function describeForecast(f: DayForecast): string {
  const parts = [`${Math.round(f.tempMinC)}–${Math.round(f.tempMaxC)} °C`];
  parts.push(
    f.precipitationMm > 0.2
      ? `${f.precipitationMm.toFixed(1)} mm Niederschlag`
      : "trocken",
  );
  parts.push(`Wind bis ${Math.round(f.windMaxKmh)} km/h`);
  return parts.join(" · ");
}

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "rain" | "snow" | "storm";

/** Ordnet einen WMO-Wettercode einer Anzeigekategorie zu. */
export function weatherKind(code: number | undefined, precipitationMm = 0): WeatherKind {
  if (code == null) return precipitationMm > 1 ? "rain" : "cloudy";
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  return "cloudy";
}

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  clear: "Sonnig",
  partly: "Teils bewölkt",
  cloudy: "Bewölkt",
  fog: "Nebel",
  rain: "Regen",
  snow: "Schnee",
  storm: "Gewitter",
};
