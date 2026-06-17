import { formatIsoDate } from "./dates";

/**
 * Körpermetriken-Auswertung (rein/testbar). Bereitet Gewicht- und Ruhepuls-
 * Verläufe für Sparklines auf und berechnet die jüngste Veränderung.
 */

export interface BodyEntry {
  date: Date | string;
  weightKg: number | null;
  restingHr: number | null;
  hrv?: number | null;
}

export interface BodySummary {
  weights: (number | null)[];
  restingHrs: (number | null)[];
  hrvs: (number | null)[];
  latestWeight: number | null;
  latestRestingHr: number | null;
  latestHrv: number | null;
  /** Gewichtsänderung gegenüber dem ältesten Eintrag im Fenster. */
  weightChange: number | null;
  /** Ruhepuls-Änderung gegenüber dem ältesten Eintrag im Fenster. */
  restingHrChange: number | null;
  /** HRV-Änderung gegenüber dem ältesten Eintrag im Fenster. */
  hrvChange: number | null;
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
  const hrvs = sorted.map((e) => e.hrv ?? null);
  const weightVals = weights.filter((v): v is number => v != null);
  const hrVals = restingHrs.filter((v): v is number => v != null);
  const hrvVals = hrvs.filter((v): v is number => v != null);

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

  const hrvChange =
    hrvVals.length >= 2
      ? Math.round(hrvVals[hrvVals.length - 1] - hrvVals[0])
      : null;

  return {
    weights,
    restingHrs,
    hrvs,
    latestWeight,
    latestRestingHr: hrVals.length ? hrVals[hrVals.length - 1] : null,
    latestHrv: hrvVals.length ? hrvVals[hrvVals.length - 1] : null,
    weightChange,
    restingHrChange,
    hrvChange,
  };
}

export type TrendLabel = "steigend" | "fallend" | "stabil";

/**
 * Tendenz aus einer chronologisch sortierten Messreihe (älteste zuerst):
 * vergleicht den Mittelwert der letzten `recentN` Werte mit dem Mittelwert
 * der `baselineN` Werte davor. Einzelne Tageswerte sind zu verrauscht, um
 * direkt eine Richtung abzulesen – der gleitende Vergleich glättet das.
 */
export function trendLabel(
  values: (number | null | undefined)[],
  opts: { recentN?: number; baselineN?: number; thresholdPct?: number } = {},
): TrendLabel | null {
  const vals = values.filter((v): v is number => v != null);
  const recentN = opts.recentN ?? 3;
  const baselineN = opts.baselineN ?? 4;
  if (vals.length < recentN + 2) return null;

  const recent = vals.slice(-recentN);
  const baseline = vals.slice(Math.max(0, vals.length - recentN - baselineN), vals.length - recentN);
  if (baseline.length === 0) return null;

  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const recentAvg = avg(recent);
  const baselineAvg = avg(baseline);
  if (baselineAvg === 0) return null;

  const deltaPct = (recentAvg - baselineAvg) / Math.abs(baselineAvg);
  const thresholdPct = opts.thresholdPct ?? 0.03;
  if (deltaPct > thresholdPct) return "steigend";
  if (deltaPct < -thresholdPct) return "fallend";
  return "stabil";
}
