"use client";

import { Card } from "./Card";
import { formatIsoDate } from "@/domain/training/dates";

interface BodyMetric {
  id: string;
  date: Date;
  weightKg: number | null;
  restingHr: number | null;
  hrv: number | null;
  notes: string | null;
}

interface ReadinessSnapshot {
  date: Date;
  sleepTrend: string | null;
  status: string | null;
}

interface BodyMetricsDetailProps {
  metrics: BodyMetric[];
  readiness: ReadinessSnapshot | null;
}

export function BodyMetricsDetail({ metrics, readiness }: BodyMetricsDetailProps) {
  // Gruppiere Readiness nach Datum für Lookup
  const readinessByDate = new Map<string, string | null>();
  if (readiness) {
    readinessByDate.set(formatIsoDate(readiness.date), readiness.status);
  }

  return (
    <Card
      title="Alle Körperwerte"
      subtitle={`${metrics.length} Einträge aus Withings, Intervals und anderen Quellen`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="px-4 py-3 text-left font-semibold text-neutral-700">Datum</th>
              <th className="px-4 py-3 text-right font-semibold text-neutral-700">Gewicht</th>
              <th className="px-4 py-3 text-right font-semibold text-neutral-700">Ruhepuls</th>
              <th className="px-4 py-3 text-right font-semibold text-neutral-700">HRV</th>
              <th className="px-4 py-3 text-left font-semibold text-neutral-700">Notizen</th>
            </tr>
          </thead>
          <tbody>
            {metrics.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  Keine Körperdaten vorhanden. Withings-Integration aktivieren oder manuell erfassen.
                </td>
              </tr>
            ) : (
              metrics.map((metric) => (
                <tr key={metric.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {metric.date.toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {metric.weightKg ? (
                      <span className="inline-block rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                        {metric.weightKg.toFixed(1)} kg
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {metric.restingHr ? (
                      <span className="inline-block rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800">
                        {metric.restingHr} bpm
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {metric.hrv ? (
                      <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {metric.hrv}
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {metric.notes ? (
                      <span
                        title={metric.notes}
                        className="line-clamp-2 max-w-xs"
                      >
                        {metric.notes}
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
