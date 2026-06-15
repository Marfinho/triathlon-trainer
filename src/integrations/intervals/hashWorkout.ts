import { createHash } from "node:crypto";

/**
 * Stabiler Inhalts-Hash eines geplanten Workouts. Identischer fachlicher Inhalt
 * ergibt denselben Hash (unabhängig von Schlüssel-Reihenfolge); jede inhaltliche
 * Änderung ergibt einen anderen Hash. Dient als Idempotenz-Schlüssel für den
 * Intervals.icu-Sync.
 */

export interface HashableWorkout {
  date: string; // YYYY-MM-DD
  sport: string;
  title: string;
  plannedDurationMin: number;
  plannedDistanceM: number | null;
  description: string | null;
  segments: unknown;
}

/** Deterministische JSON-Serialisierung mit sortierten Schlüsseln. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

export function hashWorkout(workout: HashableWorkout): string {
  const canonical = stableStringify({
    date: workout.date,
    sport: workout.sport,
    title: workout.title,
    plannedDurationMin: workout.plannedDurationMin,
    plannedDistanceM: workout.plannedDistanceM ?? null,
    description: workout.description ?? null,
    segments: workout.segments ?? [],
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/** Hilfsfunktion: Segmente robust aus JSON-String/Array lesen. */
export function parseSegments(segmentsJson: unknown): unknown {
  if (typeof segmentsJson === "string") {
    try {
      return JSON.parse(segmentsJson);
    } catch {
      return [];
    }
  }
  return segmentsJson ?? [];
}
