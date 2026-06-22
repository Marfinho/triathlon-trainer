/**
 * Energie-Forecast für geplante (noch nicht absolvierte) Workouts. Rein/
 * testbar – keine DB/HTTP-Zugriffe. Jede Schätzung trägt eine `source` (wie
 * sie zustande kam) und eine `confidence` (wie verlässlich sie ist), damit
 * nichts als Blackbox-Zahl ankommt.
 *
 * Wiederverwendet bewusst vorhandene Bausteine statt einer eigenen Schätzung:
 * - Segmente mit Power -> `buildWorkoutProfile`/`summarizeProfile` (kJ ≈ kcal,
 *   siehe analytics.ts) -> hohe Konfidenz.
 * - Nur Dauer+Sportart+Gewicht bekannt -> dieselbe MET-Tabelle wie
 *   `estimateCalories` (analytics.ts) -> mittlere Konfidenz.
 * - Weder Power noch Gewicht bekannt -> historischer Ø-kcal/min-Wert je
 *   Sportart aus den eigenen Ist-Aktivitäten -> niedrige Konfidenz.
 */

import {
  buildWorkoutProfile,
  summarizeProfile,
  type ProfileSegmentInput,
} from "../training/workoutProfile";
import { MET_BY_SPORT } from "../training/analytics";

export type EnergyForecastSource =
  | "estimated_power"
  | "estimated_duration_weight"
  | "estimated_history_based";

export type EnergyForecastConfidence = "low" | "medium" | "high";

export interface PlannedWorkoutForForecast {
  date: string; // YYYY-MM-DD
  sport: string;
  plannedDurationMin: number;
  segments?: ProfileSegmentInput[] | null;
}

export interface ForecastOptions {
  ftpWatts: number;
  weightKg: number | null;
  /** Ø kcal/min je Sportart aus der eigenen Trainingshistorie (Fallback). */
  historyAvgKcalPerMinBySport?: Record<string, number>;
}

export interface WorkoutEnergyForecast {
  date: string;
  sport: string;
  kcal: number;
  source: EnergyForecastSource;
  confidence: EnergyForecastConfidence;
}

/** Schätzt den Energiebedarf einer einzelnen geplanten Einheit. */
export function forecastWorkoutEnergy(
  workout: PlannedWorkoutForForecast,
  opts: ForecastOptions,
): WorkoutEnergyForecast | null {
  if (workout.plannedDurationMin <= 0) return null;

  const hasPowerSegments =
    Array.isArray(workout.segments) &&
    workout.segments.length > 0 &&
    workout.segments.some(
      (s) => s.targetType === "power" && typeof s.targetValue === "number",
    );

  if (hasPowerSegments && opts.ftpWatts > 0) {
    const bars = buildWorkoutProfile(workout.segments!, { ftp: opts.ftpWatts });
    const summary = summarizeProfile(bars, opts.ftpWatts);
    if (summary.kJ > 0) {
      return {
        date: workout.date,
        sport: workout.sport,
        kcal: summary.kJ,
        source: "estimated_power",
        confidence: "high",
      };
    }
  }

  if (opts.weightKg != null && opts.weightKg > 0) {
    const met = MET_BY_SPORT[workout.sport] ?? MET_BY_SPORT.other;
    const hours = workout.plannedDurationMin / 60;
    return {
      date: workout.date,
      sport: workout.sport,
      kcal: Math.round(met * opts.weightKg * hours),
      source: "estimated_duration_weight",
      confidence: "medium",
    };
  }

  const histAvg = opts.historyAvgKcalPerMinBySport?.[workout.sport];
  if (histAvg != null && histAvg > 0) {
    return {
      date: workout.date,
      sport: workout.sport,
      kcal: Math.round(histAvg * workout.plannedDurationMin),
      source: "estimated_history_based",
      confidence: "low",
    };
  }

  return null;
}

/** Schätzt den Energiebedarf mehrerer geplanter Einheiten (z.B. 3-7-Tage-Horizont). */
export function forecastEnergyBurn(
  workouts: PlannedWorkoutForForecast[],
  opts: ForecastOptions,
): WorkoutEnergyForecast[] {
  return workouts
    .map((w) => forecastWorkoutEnergy(w, opts))
    .filter((f): f is WorkoutEnergyForecast => f !== null);
}

export interface DailyEnergyForecast {
  date: string;
  kcal: number;
  /** Niedrigste Konfidenz der beitragenden Schätzungen (konservativ). */
  confidence: EnergyForecastConfidence;
  workoutCount: number;
}

const CONFIDENCE_RANK: Record<EnergyForecastConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/** Aggregiert Einzel-Schätzungen zu einer Tagessumme. */
export function aggregateForecastByDay(
  forecasts: WorkoutEnergyForecast[],
): DailyEnergyForecast[] {
  const byDay = new Map<string, DailyEnergyForecast>();
  for (const f of forecasts) {
    const existing = byDay.get(f.date);
    if (!existing) {
      byDay.set(f.date, {
        date: f.date,
        kcal: f.kcal,
        confidence: f.confidence,
        workoutCount: 1,
      });
      continue;
    }
    existing.kcal += f.kcal;
    existing.workoutCount += 1;
    if (CONFIDENCE_RANK[f.confidence] < CONFIDENCE_RANK[existing.confidence]) {
      existing.confidence = f.confidence;
    }
  }
  return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
