"use client";

import { TRI_DISTANCES, formatDuration, predictTriathlon } from "@/domain/training/prediction";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./WidgetStates";

export function RacePrediction({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const { predictionProfile } = data;
  const predictions = TRI_DISTANCES.map((tri) => ({
    tri,
    prediction: predictTriathlon(tri, predictionProfile),
  }));
  const anyConfident = predictions.some((p) => p.prediction.confidence > 0);

  if (!anyConfident) {
    return <WidgetEmpty message="Hinterlege Schwellenwerte oder Aktivitäten für eine Vorhersage." />;
  }

  if (size === "S") {
    const best = predictions.find((p) => p.tri.key === "olympic") ?? predictions[0];
    return (
      <p className="text-sm text-neutral-700">
        {best.tri.label}: {formatDuration(best.prediction.totalSec)}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {predictions.map(({ tri, prediction }) => (
        <div key={tri.key} className="flex items-center justify-between gap-2 text-sm">
          <span className="text-neutral-600">{tri.label}</span>
          <span className="font-medium text-neutral-900">
            {formatDuration(prediction.totalSec)}
          </span>
        </div>
      ))}
      {size === "L" && (
        <div className="mt-2 space-y-2 border-t border-neutral-100 pt-2">
          {predictions
            .filter((p) => p.prediction.totalSec != null)
            .map(({ tri, prediction }) => (
              <div key={tri.key} className="text-xs text-neutral-500">
                <p className="font-medium text-neutral-700">{tri.label}</p>
                <p>
                  Schwimmen {formatDuration(prediction.swimSec)} · Rad{" "}
                  {formatDuration(prediction.bikeSec)} · Laufen{" "}
                  {formatDuration(prediction.runSec)}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
