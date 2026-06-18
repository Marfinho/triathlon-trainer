import type { OpenMeteoDaily } from "@/domain/training/weather";

/**
 * Open-Meteo: kostenlose Wetter-/Geocoding-API ohne API-Key. Wird für die
 * Wettkampf-Wettervorhersage genutzt (Prognosehorizont ~16 Tage).
 */

export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
}

export async function geocodeLocation(name: string): Promise<GeocodeResult | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    name,
  )}&count=1&language=de`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding-Fehler (${res.status})`);
  const data = (await res.json()) as {
    results?: { latitude: number; longitude: number; name: string; country?: string }[];
  };
  const first = data.results?.[0];
  if (!first) return null;
  return {
    lat: first.latitude,
    lon: first.longitude,
    displayName: [first.name, first.country].filter(Boolean).join(", "),
  };
}

export async function fetchDailyForecast(lat: number, lon: number): Promise<OpenMeteoDaily> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max` +
    `&forecast_days=16&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wetter-API-Fehler (${res.status})`);
  const data = (await res.json()) as { daily?: OpenMeteoDaily };
  if (!data.daily) throw new Error("Unerwartete Antwort der Wetter-API.");
  return data.daily;
}
