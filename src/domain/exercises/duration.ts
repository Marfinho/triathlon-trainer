import type { ExerciseDefinition, SegmentExercise } from "./schema";

/**
 * Geschätzte Dauer eines Übungssegments in Sekunden (nur für Warnungen und
 * Anzeige, nicht für Planungsentscheidungen).
 *
 *  - reps:    Satzdauer = reps × (toEnd + holdEnd + toStart + holdStart)
 *  - holdSec: Satzdauer = holdSec
 *  - perSide: Satzdauer verdoppeln
 *  - Gesamt = Sätze × Satzdauer + (Sätze − 1) × restSec
 */
export function estimateExerciseDurationSec(
  exercise: Pick<SegmentExercise, "sets" | "reps" | "holdSec" | "restSec" | "perSide">,
  definition: Pick<ExerciseDefinition, "tempo">,
): number {
  const t = definition.tempo;
  const repSec = t.toEndSec + t.holdEndSec + t.toStartSec + t.holdStartSec;
  let setSec = exercise.reps != null ? exercise.reps * repSec : (exercise.holdSec ?? 0);
  if (exercise.perSide) setSec *= 2;
  const sets = exercise.sets;
  const rest = exercise.restSec ?? 0;
  return Math.round(sets * setSec + Math.max(0, sets - 1) * rest);
}

/** Kurzform der Dosierung, z. B. „3 × 8 pro Seite" oder „2 × 30 s". */
export function formatExerciseDose(
  exercise: Pick<SegmentExercise, "sets" | "reps" | "holdSec" | "perSide" | "loadKg">,
): string {
  const amount =
    exercise.reps != null ? `${exercise.reps}` : exercise.holdSec != null ? `${exercise.holdSec} s` : "";
  let s = `${exercise.sets} × ${amount}`;
  if (exercise.perSide) s += " pro Seite";
  if (exercise.loadKg != null && exercise.loadKg > 0) s += ` · ${exercise.loadKg} kg`;
  return s;
}
