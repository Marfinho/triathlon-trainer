import { formatIsoDate } from "./dates";

/**
 * Trainings-Analytics (rein/testbar). Arbeitet ausschließlich auf den
 * aggregierten Ist-Aktivitätsfeldern (Dauer, Distanz, Load, RPE, Ø-HF,
 * Ø-Power), nicht auf Sekunden-Samples – damit für alle Quellen verfügbar.
 */

export interface AnalyticsActivity {
  date: Date | string;
  sport: string;
  durationMin: number | null;
  distanceKm: number | null;
  load: number | null;
  rpe: number | null;
  avgHr: number | null;
  avgPower: number | null;
}

function iso(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : formatIsoDate(value);
}

// --------------------------------------------------------------------------
// 1) Intensitätsverteilung & Polarisierung
// --------------------------------------------------------------------------

export type IntensityBand = "easy" | "moderate" | "hard";
export type PolarizationModel = "polarisiert" | "pyramidal" | "schwellenlastig" | "unklar";

export interface IntensityDistribution {
  easyPct: number;
  moderatePct: number;
  hardPct: number;
  model: PolarizationModel;
  /** Anzahl Einheiten mit auswertbarer Intensität (RPE). */
  sampleCount: number;
}

/** Ordnet eine RPE (1–10) einem Intensitätsband zu. */
export function rpeToBand(rpe: number): IntensityBand {
  if (rpe <= 4) return "easy";
  if (rpe <= 6) return "moderate";
  return "hard";
}

/**
 * Verteilung der Trainingszeit auf easy/moderate/hard (nach RPE gewichtet mit
 * der Dauer) und eine grobe Modell-Klassifikation. Einheiten ohne RPE oder
 * Dauer werden ignoriert.
 */
export function intensityDistribution(
  activities: AnalyticsActivity[],
): IntensityDistribution {
  const minutes: Record<IntensityBand, number> = { easy: 0, moderate: 0, hard: 0 };
  let sampleCount = 0;

  for (const a of activities) {
    if (a.rpe == null || a.durationMin == null || a.durationMin <= 0) continue;
    minutes[rpeToBand(a.rpe)] += a.durationMin;
    sampleCount += 1;
  }

  const total = minutes.easy + minutes.moderate + minutes.hard;
  if (total === 0) {
    return { easyPct: 0, moderatePct: 0, hardPct: 0, model: "unklar", sampleCount: 0 };
  }

  const easyPct = Math.round((minutes.easy / total) * 100);
  const hardPct = Math.round((minutes.hard / total) * 100);
  const moderatePct = 100 - easyPct - hardPct;

  let model: PolarizationModel = "unklar";
  if (sampleCount >= 5) {
    if (easyPct >= 75 && hardPct >= 10 && moderatePct <= 15) model = "polarisiert";
    else if (easyPct >= 60 && moderatePct > hardPct) model = "pyramidal";
    else if (moderatePct >= 35) model = "schwellenlastig";
    else model = "pyramidal";
  }

  return { easyPct, moderatePct, hardPct, model, sampleCount };
}

// --------------------------------------------------------------------------
// 2) Kalorienschätzung
// --------------------------------------------------------------------------

// Grobe MET-Werte je Sportart (moderate Intensität) als Fallback, wenn keine
// Power-Daten vorliegen. Quelle: Compendium of Physical Activities (gerundet).
// Exportiert, damit der Energie-Forecast (src/domain/nutrition/forecast.ts)
// denselben Fallback statt einer eigenen Kopie nutzt.
export const MET_BY_SPORT: Record<string, number> = {
  run: 9.8,
  bike: 7.5,
  swim: 8.3,
  strength: 5.0,
  walk: 3.5,
  row: 7.0,
  other: 6.0,
};

/**
 * Schätzt den Energieverbrauch einer Einheit in kcal.
 * - Mit Ø-Power (Rad): kJ ≈ Watt·s; mechanische Arbeit ≈ kcal (Wirkungsgrad
 *   ~24 % hebt die kJ→kcal-Umrechnung näherungsweise auf → kJ ≈ kcal).
 * - Sonst MET-basiert: kcal = MET·kg·h.
 */
export function estimateCalories(
  activity: AnalyticsActivity,
  weightKg: number | null,
): number | null {
  const { durationMin, avgPower, sport } = activity;
  if (durationMin == null || durationMin <= 0) return null;

  if (avgPower != null && avgPower > 0) {
    const kj = (avgPower * durationMin * 60) / 1000;
    return Math.round(kj);
  }

  if (weightKg == null || weightKg <= 0) return null;
  const met = MET_BY_SPORT[sport] ?? MET_BY_SPORT.other;
  const hours = durationMin / 60;
  return Math.round(met * weightKg * hours);
}

// --------------------------------------------------------------------------
// 3) Aerobe Effizienz (Power- bzw. Pace-zu-HF)
// --------------------------------------------------------------------------

export interface EfficiencyPoint {
  date: string;
  /** Effizienzfaktor: Watt pro Herzschlag·... bzw. Geschwindigkeit/HF. */
  ef: number;
}

/**
 * Aerobe Effizienz je Einheit. Für Rad/Power: avgPower/avgHr. Für Lauf ohne
 * Power: Geschwindigkeit (km/h) pro HF·100. Höhere Werte = ökonomischer.
 * Steigt der Wert bei vergleichbarer HF, verbessert sich die aerobe Fitness.
 */
export function efficiencyTrend(activities: AnalyticsActivity[]): EfficiencyPoint[] {
  const points: EfficiencyPoint[] = [];
  for (const a of activities) {
    if (a.avgHr == null || a.avgHr <= 0) continue;
    let ef: number | null = null;
    if (a.avgPower != null && a.avgPower > 0) {
      ef = Math.round((a.avgPower / a.avgHr) * 100) / 100;
    } else if (a.distanceKm != null && a.durationMin != null && a.durationMin > 0) {
      const kmh = a.distanceKm / (a.durationMin / 60);
      ef = Math.round((kmh / a.avgHr) * 100) / 100;
    }
    if (ef != null && Number.isFinite(ef)) {
      points.push({ date: iso(a.date), ef });
    }
  }
  return points.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

// --------------------------------------------------------------------------
// 4) Triathlon-Sportbalance
// --------------------------------------------------------------------------

export interface SportShare {
  sport: string;
  minutes: number;
  pct: number;
}

export interface SportBalance {
  shares: SportShare[];
  /** Hinweis, falls eine der drei Triathlon-Disziplinen deutlich unterrepräsentiert ist. */
  warning: string | null;
}

const TRI_SPORTS = ["swim", "bike", "run"];

export function sportBalance(activities: AnalyticsActivity[]): SportBalance {
  const minutesBySport = new Map<string, number>();
  let total = 0;
  for (const a of activities) {
    const min = a.durationMin ?? 0;
    if (min <= 0) continue;
    minutesBySport.set(a.sport, (minutesBySport.get(a.sport) ?? 0) + min);
    total += min;
  }

  const shares: SportShare[] = [...minutesBySport.entries()]
    .map(([sport, minutes]) => ({
      sport,
      minutes: Math.round(minutes),
      pct: total > 0 ? Math.round((minutes / total) * 100) : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  let warning: string | null = null;
  const triTotal = TRI_SPORTS.reduce((s, sp) => s + (minutesBySport.get(sp) ?? 0), 0);
  if (triTotal > 0) {
    const neglected = TRI_SPORTS.filter((sp) => {
      const pct = (minutesBySport.get(sp) ?? 0) / triTotal;
      return pct < 0.1;
    });
    if (neglected.length > 0) {
      const labels: Record<string, string> = { swim: "Schwimmen", bike: "Rad", run: "Laufen" };
      warning = `Unausgewogen: ${neglected
        .map((s) => labels[s] ?? s)
        .join(", ")} unter 10 % der Triathlon-Zeit.`;
    }
  }

  return { shares, warning };
}

// --------------------------------------------------------------------------
// 5) Monatsvolumen
// --------------------------------------------------------------------------

export interface MonthlyVolume {
  month: string; // YYYY-MM
  hours: number;
  km: number;
  load: number;
  sessions: number;
}

export function buildMonthlyVolume(activities: AnalyticsActivity[]): MonthlyVolume[] {
  const byMonth = new Map<string, MonthlyVolume>();
  for (const a of activities) {
    const month = iso(a.date).slice(0, 7);
    const m =
      byMonth.get(month) ??
      byMonth.set(month, { month, hours: 0, km: 0, load: 0, sessions: 0 }).get(month)!;
    m.hours += (a.durationMin ?? 0) / 60;
    m.km += a.distanceKm ?? 0;
    m.load += a.load ?? 0;
    m.sessions += 1;
  }
  return [...byMonth.values()]
    .map((m) => ({
      month: m.month,
      hours: Math.round(m.hours * 10) / 10,
      km: Math.round(m.km),
      load: Math.round(m.load),
      sessions: m.sessions,
    }))
    .sort((a, b) => (a.month < b.month ? -1 : 1));
}

// --------------------------------------------------------------------------
// 6) Best-Pace je Sportart
// --------------------------------------------------------------------------

export interface BestPace {
  sport: string;
  /** Schnellste Pace in Sekunden je km. */
  secPerKm: number;
  date: string;
  distanceKm: number;
}

/**
 * Schnellste Durchschnitts-Pace je Sportart über alle Einheiten mit Distanz &
 * Dauer. Sehr kurze Einheiten (< 1 km) werden ignoriert, um Sprints/Mess-
 * artefakte auszuschließen.
 */
export function bestPaceBySport(activities: AnalyticsActivity[]): BestPace[] {
  const best = new Map<string, BestPace>();
  for (const a of activities) {
    if (a.distanceKm == null || a.distanceKm < 1) continue;
    if (a.durationMin == null || a.durationMin <= 0) continue;
    const secPerKm = Math.round((a.durationMin * 60) / a.distanceKm);
    const current = best.get(a.sport);
    if (!current || secPerKm < current.secPerKm) {
      best.set(a.sport, {
        sport: a.sport,
        secPerKm,
        date: iso(a.date),
        distanceKm: Math.round(a.distanceKm * 10) / 10,
      });
    }
  }
  return [...best.values()].sort((a, b) => a.sport.localeCompare(b.sport));
}
