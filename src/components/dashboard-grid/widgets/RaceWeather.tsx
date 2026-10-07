"use client";

import { useEffect, useState } from "react";
import {
  describeForecast,
  weatherKind,
  WEATHER_LABEL,
  type DayForecast,
} from "@/domain/training/weather";
import { WeatherIcon } from "./WeatherIcon";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./WidgetStates";

interface WeatherResult {
  ok: boolean;
  locationName: string | null;
  forecast: DayForecast | null;
  outOfHorizon: boolean;
  error?: string;
}

export function RaceWeather({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();
  const [location, setLocation] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [result, setResult] = useState<WeatherResult | null>(null);

  const nextRace = data?.races.nextRace ?? null;

  useEffect(() => {
    if (!nextRace) return;
    setLocation(nextRace.locationName ?? "");
    void loadWeather(nextRace.id, nextRace.locationName);
  }, [nextRace?.id]);

  async function loadWeather(raceId: string, locationOverride: string | null) {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const url = locationOverride?.trim()
        ? `/api/races/${raceId}/weather?location=${encodeURIComponent(locationOverride.trim())}`
        : `/api/races/${raceId}/weather`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.ok) {
        setWeatherError(json.error ?? "Wetterabruf fehlgeschlagen.");
        setResult(null);
        return;
      }
      setResult(json);
    } catch (e) {
      setWeatherError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setWeatherLoading(false);
    }
  }

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  if (!nextRace) {
    return <WidgetEmpty message="Kein anstehendes Rennen für eine Wettervorhersage." />;
  }

  if (size === "S") {
    if (weatherLoading) return <p className="text-sm text-neutral-400">Lade Wetter…</p>;
    if (result?.forecast && !result.outOfHorizon) {
      return <p className="text-sm text-neutral-700">{describeForecast(result.forecast)}</p>;
    }
    return <p className="text-sm text-neutral-400">Noch kein Wetter verfügbar.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500">{nextRace.name}</p>
      {weatherError === "Kein Standort hinterlegt. Bitte ?location=<Ort> angeben." ? (
        <div className="flex flex-wrap items-end gap-2">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="z.B. Roth, Deutschland"
            className="h-11 flex-1 rounded-lg border border-neutral-300 bg-white px-2 text-sm"
          />
          <button
            onClick={() => loadWeather(nextRace.id, location)}
            disabled={weatherLoading}
            className="h-11 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {weatherLoading ? "Lade…" : "Wetter laden"}
          </button>
        </div>
      ) : weatherError ? (
        <p className="text-xs text-rose-600">{weatherError}</p>
      ) : weatherLoading ? (
        <p className="text-sm text-neutral-400">Lade Wetter…</p>
      ) : result?.outOfHorizon || !result?.forecast ? (
        <p className="text-sm text-neutral-500">
          Renntag liegt außerhalb des ~16-Tage-Prognosehorizonts.
        </p>
      ) : (
        <ForecastView forecast={result.forecast} locationName={result.locationName} size={size} />
      )}
    </div>
  );
}

function ForecastView({
  forecast,
  locationName,
  size,
}: {
  forecast: DayForecast;
  locationName: string | null;
  size: WidgetSize;
}) {
  const kind = weatherKind(forecast.weatherCode, forecast.precipitationMm);
  const rainy = forecast.precipitationMm > 0.2;
  return (
    <div>
      <div className="flex items-center gap-3">
        <WeatherIcon kind={kind} size={size === "L" ? 64 : 48} />
        <div>
          <p className="text-2xl font-semibold leading-none text-neutral-900">
            {Math.round(forecast.tempMaxC)}°
            <span className="ml-1 text-base font-normal text-neutral-400">
              / {Math.round(forecast.tempMinC)}°
            </span>
          </p>
          <p className="mt-1 text-xs text-neutral-600">{WEATHER_LABEL[kind]}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
          {rainy ? `${forecast.precipitationMm.toFixed(1)} mm` : "trocken"}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
          Wind {Math.round(forecast.windMaxKmh)} km/h
        </span>
      </div>
      {size === "L" && locationName && (
        <p className="mt-2 text-xs text-neutral-400">📍 {locationName}</p>
      )}
    </div>
  );
}
