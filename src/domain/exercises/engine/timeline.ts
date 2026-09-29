import type { ExerciseDefinition } from "../schema";

/** Quadratisches Ein- und Ausblenden (1:1 aus der Referenz-Engine). */
export function ease(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
}

/** Phase der Bewegung: 0 zum Ende, 1 Halten am Ende, 2 zurück, 3 Halten am Start. */
export type TimelinePhase = 0 | 1 | 2 | 3;

export type TempoInput = ExerciseDefinition["tempo"] | readonly [number, number, number, number];

function tempoArray(tempo: TempoInput): readonly [number, number, number, number] {
  return Array.isArray(tempo)
    ? (tempo as readonly [number, number, number, number])
    : [
        (tempo as ExerciseDefinition["tempo"]).toEndSec,
        (tempo as ExerciseDefinition["tempo"]).holdEndSec,
        (tempo as ExerciseDefinition["tempo"]).toStartSec,
        (tempo as ExerciseDefinition["tempo"]).holdStartSec,
      ];
}

/** Gesamtdauer einer Wiederholung in Sekunden. */
export function tempoTotal(tempo: TempoInput): number {
  return tempoArray(tempo).reduce((a, b) => a + b, 0);
}

/**
 * Position in der Bewegung zur Zeit `tau` (Sekunden seit Start der
 * Wiederholung): u = 0 Start, 1 Ende; `ph` = Phase.
 */
export function timelineAt(tempo: TempoInput, tau: number): { u: number; ph: TimelinePhase } {
  const [a, b, c] = tempoArray(tempo);
  if (tau < a) return { u: ease(tau / a), ph: 0 };
  if (tau < a + b) return { u: 1, ph: 1 };
  if (tau < a + b + c) return { u: 1 - ease((tau - a - b) / c), ph: 2 };
  return { u: 0, ph: 3 };
}
