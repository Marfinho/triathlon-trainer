"use client";

import { Card } from "./Card";

interface BodyStatsGridProps {
  latest: {
    date: Date;
    weightKg: number | null;
    restingHr: number | null;
    hrv: number | null;
  } | null;
  weightTrend: string;
  hrvTrend: string;
  restingHrTrend: string;
  heightCm: number | null;
}

export function BodyStatsGrid({
  latest,
  weightTrend,
  hrvTrend,
  restingHrTrend,
  heightCm,
}: BodyStatsGridProps) {
  const bmi =
    latest?.weightKg && heightCm
      ? (latest.weightKg / ((heightCm / 100) ** 2)).toFixed(1)
      : null;

  return (
    <Card title="Aktuelle Körperwerte" subtitle={latest?.date.toLocaleDateString("de-DE")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Gewicht */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-medium text-neutral-600 uppercase">Gewicht</p>
          {latest?.weightKg ? (
            <>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">
                {latest.weightKg.toFixed(1)} <span className="text-sm text-neutral-600">kg</span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">{weightTrend}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">Keine Daten</p>
          )}
        </div>

        {/* Ruhepuls */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-medium text-neutral-600 uppercase">Ruhepuls</p>
          {latest?.restingHr ? (
            <>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">
                {latest.restingHr} <span className="text-sm text-neutral-600">bpm</span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">{restingHrTrend}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">Keine Daten</p>
          )}
        </div>

        {/* HRV */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-medium text-neutral-600 uppercase">HRV</p>
          {latest?.hrv ? (
            <>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">
                {latest.hrv}
              </p>
              <p className="mt-1 text-xs text-neutral-500">{hrvTrend}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">Keine Daten</p>
          )}
        </div>

        {/* BMI */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-medium text-neutral-600 uppercase">BMI</p>
          {bmi ? (
            <>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{bmi}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {parseFloat(bmi) < 18.5
                  ? "Untergewicht"
                  : parseFloat(bmi) < 25
                    ? "Normal"
                    : parseFloat(bmi) < 30
                      ? "Übergewicht"
                      : "Adipositas"}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">Keine Daten</p>
          )}
        </div>
      </div>
    </Card>
  );
}
