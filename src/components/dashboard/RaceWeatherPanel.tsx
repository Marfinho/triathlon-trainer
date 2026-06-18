"use client";

import { useState } from "react";
import { describeForecast, type DayForecast } from "@/domain/training/weather";

export function RaceWeatherPanel({
  raceId,
  initialLocationName,
}: {
  raceId: string;
  initialLocationName: string | null;
}) {
  const [location, setLocation] = useState(initialLocationName ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    locationName: string | null;
    forecast: DayForecast | null;
    outOfHorizon: boolean;
  } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const url = location.trim()
        ? `/api/races/${raceId}/weather?location=${encodeURIComponent(location.trim())}`
        : `/api/races/${raceId}/weather`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Wetterabruf fehlgeschlagen.");
        setResult(null);
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-neutral-500">
          Renn-Standort
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="z.B. Roth, Deutschland"
            className="mt-1 block w-56 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {loading ? "Lade…" : "Wetter laden"}
        </button>
      </div>

      {error ? (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-2 text-sm">
          {result.locationName ? (
            <p className="text-xs text-neutral-400">{result.locationName}</p>
          ) : null}
          {result.outOfHorizon || !result.forecast ? (
            <p className="text-neutral-500">
              Renntag liegt außerhalb des ~16-Tage-Prognosehorizonts – bitte näher am Termin erneut laden.
            </p>
          ) : (
            <p className="font-medium text-neutral-800">{describeForecast(result.forecast)}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
