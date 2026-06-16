import { formatIsoDate } from "./dates";

/**
 * Körpermetriken-Auswertung (rein/testbar). Bereitet Gewicht- und Ruhepuls-
 * Verläufe für Sparklines auf und berechnet die jüngste Veränderung.
 */

export interface BodyEntry {
  date: Date | string;
  weightKg: number | null;
  restingHr: number | null;
}

export interface BodySummary {
  weights: (number | null)[];
  restingHrs: (number | null)[];
  latestWeight: number | null;
  latestRestingHr: number | null;
  /** Gewichtsänderung gegenüber dem ältesten Eintrag im Fenster. */
  weightChange: number | null;
  /** Ruhepuls-Änderung gegenüber dem ältesten Eintrag im Fenster. */
  restingHrChange: number | null;
}

/** Erwartet Einträge in beliebiger Reihenfolge; sortiert aufsteigend. */
export function summarizeBody(entries: BodyEntry[]): BodySummary {
  const sorted = [...entries].sort((a, b) => {
    const da = typeof a.date === "string" ? a.date : formatIsoDate(a.date);
    const db = typeof b.date === "string" ? b.date : formatIsoDate(b.date);
    return da < db ? -1 : da > db ? 1 : 0;
  });

  const weights = sorted.map((e) => e.weightKg ?? null);
  const restingHrs = sorted.map((e) => e.restingHr ?? null);
  const weightVals = weights.filter((v): v is number => v != null);
  const hrVals = restingHrs.filter((v): v is number => v != null);

  const latestWeight = weightVals.length ? weightVals[weightVals.length - 1] : null;
  const firstWeight = weightVals.length ? weightVals[0] : null;
  // Eine Veränderung lässt sich erst ab zwei Messwerten sinnvoll berechnen.
  const weightChange =
    weightVals.length >= 2 && latestWeight != null && firstWeight != null
      ? Math.round((latestWeight - firstWeight) * 10) / 10
      : null;

  const restingHrChange =
    hrVals.length >= 2
      ? Math.round(hrVals[hrVals.length - 1] - hrVals[0])
      : null;

  return {
    weights,
    restingHrs,
    latestWeight,
    latestRestingHr: hrVals.length ? hrVals[hrVals.length - 1] : null,
    weightChange,
    restingHrChange,
  };
}
