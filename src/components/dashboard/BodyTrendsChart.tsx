"use client";

import { Card } from "./Card";

interface BodyMetric {
  date: Date;
  weightKg: number | null;
  restingHr: number | null;
  hrv: number | null;
}

interface BodyTrendsChartProps {
  bodyMetrics: BodyMetric[];
  weightKgs: (number | null)[];
  restingHrs: (number | null)[];
  hrvs: (number | null)[];
}

export function BodyTrendsChart({
  bodyMetrics,
  weightKgs,
  restingHrs,
  hrvs,
}: BodyTrendsChartProps) {
  // Letzte 30 Tage mit Daten
  const last30 = bodyMetrics.slice(0, 30).reverse();

  return (
    <Card title="Trends (letzte 30 Tage)" subtitle="Gewicht, Ruhepuls und HRV">
      <div className="space-y-6">
        {/* Gewicht */}
        {weightKgs.some((w) => w !== null) && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Gewicht</h3>
            <div className="space-y-2">
              {last30
                .filter((m) => m.weightKg !== null)
                .map((metric, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="w-24 text-neutral-600">
                      {metric.date.toLocaleDateString("de-DE")}
                    </span>
                    <div className="flex-1 mx-3 h-6 bg-neutral-100 rounded relative overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                        style={{
                          width: `${
                            metric.weightKg
                              ? ((metric.weightKg - 50) / 50) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right font-semibold text-neutral-900">
                      {metric.weightKg?.toFixed(1)} kg
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Ruhepuls */}
        {restingHrs.some((hr) => hr !== null) && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Ruhepuls</h3>
            <div className="space-y-2">
              {last30
                .filter((m) => m.restingHr !== null)
                .map((metric, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="w-24 text-neutral-600">
                      {metric.date.toLocaleDateString("de-DE")}
                    </span>
                    <div className="flex-1 mx-3 h-6 bg-neutral-100 rounded relative overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-orange-600"
                        style={{
                          width: `${Math.min(100, (metric.restingHr! / 100) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right font-semibold text-neutral-900">
                      {metric.restingHr} bpm
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* HRV */}
        {hrvs.some((h) => h !== null) && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">HRV</h3>
            <div className="space-y-2">
              {last30
                .filter((m) => m.hrv !== null)
                .map((metric, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="w-24 text-neutral-600">
                      {metric.date.toLocaleDateString("de-DE")}
                    </span>
                    <div className="flex-1 mx-3 h-6 bg-neutral-100 rounded relative overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                        style={{
                          width: `${
                            metric.hrv
                              ? Math.min(100, (metric.hrv / 200) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right font-semibold text-neutral-900">
                      {metric.hrv}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
