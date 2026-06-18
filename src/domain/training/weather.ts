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
}

export interface DayForecast {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipitationMm: number;
  windMaxKmh: number;
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
