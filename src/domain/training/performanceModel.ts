/**
 * Datengetriebenes Leistungsmodell für Wettkampf-Zielkorridore (rein/testbar).
 *
 * Statt eine Zielzeit nur aus einem eingetragenen Schwellenwert abzuleiten,
 * schätzt das Modell die aktuelle Leistungsfähigkeit je Disziplin aus ALLEN
 * vorhandenen Trainingsdaten und liefert daraus einen realistischen Korridor
 * (schnell / wahrscheinlich / vorsichtig) statt eines Einzelwerts.
 *
 * Kerngröße je Disziplin ("Kapazität"):
 *   - Laufen:    Schwellentempo (m/s), das ~60 min maximal gehalten werden kann
 *   - Rad:       FTP (W) – oder, ohne Leistungsmesser, Schwellengeschwindigkeit (km/h)
 *   - Schwimmen: CSS-Tempo (m/s), ~30 min maximal haltbar
 *
 * Jede Aktivität liefert eine eigene Schätzung dieser Kapazität. Dafür wird ihre
 * Intensität relativ zur Schwelle bestimmt aus
 *   - Herzfrequenz (relativ zur Schwellen-HF, mit Drift-Korrektur bei langer
 *     Dauer; die HF→Tempo-Beziehung wird – wenn genug Daten da sind – per
 *     gewichteter Regression individuell kalibriert),
 *   - RPE (subjektive Anstrengung, relativ zur maximal haltbaren Intensität
 *     für die jeweilige Dauer),
 *   - Dauer/Strecke (Riegel- bzw. Power-Duration-Modell),
 *   - Höhenmetern (Umrechnung auf flaches Äquivalent).
 * Dazu kommen Wettkampfergebnisse (stärkstes Signal), die Profilwerte (als eine
 * Quelle unter mehreren) und die beste demonstrierte Leistung als Untergrenze.
 * Alle Schätzungen werden nach Aktualität und Aussagekraft gewichtet; die
 * Streuung der Einzelschätzungen bestimmt die Breite des Korridors.
 *
 * Für die Renndistanz fließen zusätzlich der persönliche Ermüdungsexponent
 * (Riegel), die Ausdauer-Abdeckung (längste Einheiten der letzten Wochen im
 * Verhältnis zur Renndauer) und die Extrapolationsweite in Tempo und Breite ein.
 */

import {
  calibrateRiegelExponent,
  RUN_DISTANCES,
  TRI_DISTANCES,
  type TriProfile,
} from "./prediction";

// ---------------------------------------------------------------------------
// Eingaben
// ---------------------------------------------------------------------------

export interface PerfActivity {
  date: Date | string;
  sport: string;
  durationMin: number | null;
  distanceKm: number | null;
  avgHr: number | null;
  maxHr?: number | null;
  avgPower: number | null;
  rpe: number | null;
  elevationGainM?: number | null;
}

export interface PerfRaceResult {
  date: Date | string;
  type: string;
  distance: string | null;
  resultSeconds: number | null;
  completed: boolean;
}

export interface PerfInput {
  activities: PerfActivity[];
  races?: PerfRaceResult[];
  thresholdHr?: number | null;
  thresholdPaceSecPerKm?: number | null;
  ftpWatts?: number | null;
  cssPer100m?: number | null;
  today?: Date;
}

// ---------------------------------------------------------------------------
// Ausgaben
// ---------------------------------------------------------------------------

export type SourceKind = "race" | "maxEffort" | "heartRate" | "rpe" | "volume" | "profile";

export interface SourceSummary {
  kind: SourceKind;
  count: number;
  /** Anteil am Gesamtgewicht (0..1). */
  share: number;
}

export interface CapacityEstimate {
  /** Laufen/Schwimmen: m/s · Rad: W (mode "power") oder km/h (mode "speed"). */
  value: number;
  /** Relative Unsicherheit (≈1σ) der Kapazität. */
  relSpread: number;
  /** Anzahl Aktivitäten/Ergebnisse, die eingeflossen sind. */
  samples: number;
  sources: SourceSummary[];
  /** True, wenn die beste gezeigte Leistung die Schätzung angehoben hat. */
  flooredByBestEffort: boolean;
}

export interface RunModel extends CapacityEstimate {
  riegelExponent: number;
  /** Längste Laufdauer (min) der letzten 10 Wochen – für Ausdauer-Abdeckung. */
  longestRecentMin: number;
  /** HF→Tempo individuell kalibriert? */
  personalHrCurve: boolean;
}

export interface BikeModel extends CapacityEstimate {
  mode: "power" | "speed";
  /** Persönlicher Faktor v = c · P^(1/3) (km/h), nur im Power-Modus. */
  speedPerCubeRootW: number | null;
  personalSpeedModel: boolean;
  longestRecentMin: number;
  personalHrCurve: boolean;
}

export interface SwimModel extends CapacityEstimate {
  longestRecentMin: number;
}

export interface PerformanceModel {
  run: RunModel | null;
  bike: BikeModel | null;
  swim: SwimModel | null;
  /** Genutzte Schwellen-HF (Profil oder aus Max-HF geschätzt). */
  thresholdHr: number | null;
  thresholdHrEstimated: boolean;
}

export interface Corridor {
  fastSec: number;
  likelySec: number;
  slowSec: number;
}

export type Confidence = "hoch" | "mittel" | "niedrig";

export interface RunForecast {
  key: string;
  label: string;
  distanceKm: number;
  corridor: Corridor;
  /** Pace-Korridor in s/km (schnell → vorsichtig). */
  pace: Corridor;
  confidence: Confidence;
  notes: string[];
}

export interface TriForecast {
  key: string;
  label: string;
  swim: Corridor | null;
  bike: Corridor | null;
  run: Corridor | null;
  transitionSec: number;
  total: Corridor | null;
  /** Rad-Zielleistung (W) bzw. -tempo (km/h), falls bestimmbar. */
  bikeTarget: { watts: number | null; kmh: number } | null;
  runPaceSecPerKm: Corridor | null;
  swimPacePer100m: Corridor | null;
  confidence: Confidence;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Konstanten / Annahmen (bewusst transparent)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 180;
const RACE_WINDOW_DAYS = 540;
const HALF_LIFE_DAYS = 45;
const RACE_HALF_LIFE_DAYS = 120;
const DAY_FORM_SPREAD = 0.02; // Tagesform/Bedingungen am Renntag

/**
 * Anteil der für die jeweilige Dauer maximal haltbaren Intensität je RPE
 * (10 = volle Ausbelastung). Tempo-Skala (Laufen/Schwimmen/Rad-Speed).
 */
const RPE_SPEED_FRACTION: Record<number, number> = {
  1: 0.62, 2: 0.67, 3: 0.72, 4: 0.77, 5: 0.81, 6: 0.85, 7: 0.89, 8: 0.93, 9: 0.97, 10: 1.0,
};
/** Dasselbe auf der Leistungs-Skala (Watt reagiert stärker als Tempo). */
const RPE_POWER_FRACTION: Record<number, number> = {
  1: 0.45, 2: 0.52, 3: 0.59, 4: 0.65, 5: 0.71, 6: 0.77, 7: 0.83, 8: 0.89, 9: 0.95, 10: 1.0,
};

/** Generische Steigung Intensität vs. %Schwellen-HF (wird individuell ersetzt). */
const HR_SLOPE_RUN = 1.3;
const HR_SLOPE_SWIM = 1.3;
const HR_SLOPE_BIKE_POWER = 2.0;
const HR_SLOPE_BIKE_SPEED = 0.7;
/** Rad-Schwellen-HF liegt typischerweise etwas unter der Lauf-Schwellen-HF. */
const BIKE_LTHR_FACTOR = 0.96;
/** Power-Duration: P_max(t) = FTP · (t/60 min)^-0.07. */
const BIKE_PD_EXP = 0.07;
/** Schwimmen: CSS ≈ 30-min-Tempo, flache Ermüdungskurve. */
const SWIM_REF_SEC = 1800;
const SWIM_RIEGEL = 1.03;

const DEFAULT_BIKE_C = 36 / 200 ** (1 / 3); // 36 km/h bei 200 W (TT, flach)

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function ageDays(d: Date | string, today: Date): number {
  return (today.getTime() - toDate(d).getTime()) / DAY_MS;
}

function recencyWeight(age: number, halfLife: number): number {
  return 0.5 ** (Math.max(0, age) / halfLife);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function rpeFraction(rpe: number, table: Record<number, number>): number {
  const r = clamp(rpe, 1, 10);
  const lo = Math.floor(r);
  const hi = Math.ceil(r);
  return table[lo] + (table[hi] - table[lo]) * (r - lo);
}

/** Relative maximal haltbare Geschwindigkeit für Dauer t bei Riegel-Exponent e (1 h = 1). */
function runMaxIntensity(timeSec: number, e: number): number {
  return (timeSec / 3600) ** ((1 - e) / e);
}

function swimMaxIntensity(timeSec: number): number {
  return (timeSec / SWIM_REF_SEC) ** ((1 - SWIM_RIEGEL) / SWIM_RIEGEL);
}

function bikeMaxPowerIntensity(timeSec: number): number {
  return (timeSec / 3600) ** -BIKE_PD_EXP;
}

/** HF-Drift: bei langen Einheiten steigt die HF bei gleichem Tempo (~3 %/h ab 45 min). */
function driftCorrectedHrPct(avgHr: number, lthr: number, durationMin: number): number {
  const drift = clamp(((durationMin - 45) / 60) * 0.03, 0, 0.06);
  return avgHr / lthr - drift;
}

interface Estimate {
  value: number;
  weight: number;
  kind: SourceKind;
}

interface Combined {
  value: number;
  relSpread: number;
  sources: SourceSummary[];
  totalWeight: number;
}

/** Gewichtetes Mittel im Log-Raum + Streuung → Kapazität und Unsicherheit. */
function combine(estimates: Estimate[]): Combined | null {
  const valid = estimates.filter((e) => e.value > 0 && Number.isFinite(e.value) && e.weight > 0);
  if (valid.length === 0) return null;
  const W = valid.reduce((s, e) => s + e.weight, 0);
  const W2 = valid.reduce((s, e) => s + e.weight * e.weight, 0);
  const meanLog = valid.reduce((s, e) => s + e.weight * Math.log(e.value), 0) / W;
  const variance =
    valid.reduce((s, e) => s + e.weight * (Math.log(e.value) - meanLog) ** 2, 0) / W;
  const sd = Math.sqrt(variance);
  const nEff = (W * W) / W2;

  // Unsicherheit der Kapazität: Standardfehler der Schätzungen, dazu ein
  // Anteil der Einzelstreuung (Modellfehler) und ein Aufschlag bei dünner Datenlage.
  const sparse = W < 2 ? 0.06 : W < 5 ? 0.03 : 0;
  const relSpread = clamp(
    Math.sqrt(sd * sd / Math.max(1, nEff) + (0.35 * sd) ** 2 + sparse * sparse + 0.01 ** 2),
    0.015,
    0.15,
  );

  const byKind = new Map<SourceKind, { count: number; weight: number }>();
  for (const e of valid) {
    const cur = byKind.get(e.kind) ?? { count: 0, weight: 0 };
    cur.count++;
    cur.weight += e.weight;
    byKind.set(e.kind, cur);
  }
  const sources = [...byKind.entries()]
    .map(([kind, v]) => ({ kind, count: v.count, share: v.weight / W }))
    .sort((a, b) => b.share - a.share);

  return { value: Math.exp(meanLog), relSpread, sources, totalWeight: W };
}

interface Regression {
  intercept: number;
  slope: number;
}

function weightedRegression(points: { x: number; y: number; w: number }[]): Regression | null {
  const W = points.reduce((s, p) => s + p.w, 0);
  if (W <= 0) return null;
  const mx = points.reduce((s, p) => s + p.w * p.x, 0) / W;
  const my = points.reduce((s, p) => s + p.w * p.y, 0) / W;
  const sxx = points.reduce((s, p) => s + p.w * (p.x - mx) ** 2, 0);
  const sxy = points.reduce((s, p) => s + p.w * (p.x - mx) * (p.y - my), 0);
  if (sxx <= 0) return null;
  const slope = sxy / sxx;
  return { intercept: my - slope * mx, slope };
}

/**
 * Individuelle Steigung "Intensität pro %Schwellen-HF": Regression y ~ hrPct,
 * normiert auf den Wert an der Schwelle (hrPct = 1). Nur bei genügend Punkten
 * und ausreichender HF-Spreizung, und nur in einem plausiblen Bereich.
 */
function personalHrSlope(
  points: { x: number; y: number; w: number }[],
  bounds: [number, number],
): number | null {
  if (points.length < 8) return null;
  const xs = points.map((p) => p.x);
  if (Math.max(...xs) - Math.min(...xs) < 0.08) return null;
  const reg = weightedRegression(points);
  if (!reg || reg.slope <= 0) return null;
  const atThreshold = reg.intercept + reg.slope;
  if (atThreshold <= 0) return null;
  const k = reg.slope / atThreshold;
  return k >= bounds[0] && k <= bounds[1] ? k : null;
}

/** Parst eine Renn-Distanz ("10k", "Halbmarathon", "12,5 km") in km. */
export function parseRunDistanceKm(distance: string | null): number | null {
  if (!distance) return null;
  const d = distance.toLowerCase().trim();
  const known = RUN_DISTANCES.find(
    (r) => r.key === d || r.label.toLowerCase() === d,
  );
  if (known) return known.km;
  if (/halb|half|^hm$/.test(d)) return 21.0975;
  if (/marathon|^m$/.test(d)) return 42.195;
  const m = d.match(/^(\d+(?:[.,]\d+)?)\s*(k|km)?$/);
  if (m) {
    const km = parseFloat(m[1].replace(",", "."));
    return km > 0 && km <= 100 ? km : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Schwellen-HF
// ---------------------------------------------------------------------------

/** Profil-Schwellen-HF oder – falls leer – ~90 % der höchsten gemessenen HF. */
export function resolveThresholdHr(
  activities: PerfActivity[],
  profileLthr: number | null | undefined,
  today: Date,
): { lthr: number | null; estimated: boolean } {
  if (profileLthr != null && profileLthr > 0) return { lthr: profileLthr, estimated: false };
  let maxHr = 0;
  for (const a of activities) {
    if (ageDays(a.date, today) > 365) continue;
    if (a.sport !== "run" && a.sport !== "bike") continue;
    if (a.maxHr != null && a.maxHr > maxHr && a.maxHr < 230) maxHr = a.maxHr;
  }
  return maxHr >= 140 ? { lthr: Math.round(maxHr * 0.9), estimated: true } : { lthr: null, estimated: false };
}

// ---------------------------------------------------------------------------
// Laufen
// ---------------------------------------------------------------------------

interface RunSampleInternal {
  timeSec: number;
  speed: number; // m/s, höhenbereinigt
  rpe: number | null;
  hrPct: number | null;
  w: number;
  durationMin: number;
}

export function buildRunModel(input: PerfInput, lthr: number | null): RunModel | null {
  const today = input.today ?? new Date();
  const runs = input.activities.filter((a) => a.sport === "run");

  const exponent = calibrateRiegelExponent(
    runs
      .filter((a) => ageDays(a.date, today) <= 365)
      .map((a) => ({ sport: "run", distanceKm: a.distanceKm, durationMin: a.durationMin })),
  ).exponent;

  const samples: RunSampleInternal[] = [];
  let longestRecentMin = 0;
  for (const a of runs) {
    const age = ageDays(a.date, today);
    if (age < 0 || age > WINDOW_DAYS) continue;
    if (!a.distanceKm || !a.durationMin) continue;
    if (age <= 70) longestRecentMin = Math.max(longestRecentMin, a.durationMin);
    if (a.distanceKm < 2 || a.durationMin < 12) continue;
    const timeSec = a.durationMin * 60;
    const paceSecPerKm = timeSec / a.distanceKm;
    if (paceSecPerKm < 150 || paceSecPerKm > 720) continue;

    const gainPerKm = (a.elevationGainM ?? 0) / a.distanceKm;
    // ~100 Hm (bergauf, Runde mit gleichem Abstieg) kosten etwa 400 m Flachstrecke.
    const effKm = a.distanceKm + Math.max(0, a.elevationGainM ?? 0) * 0.004;
    let w = recencyWeight(age, HALF_LIFE_DAYS);
    if (gainPerKm > 40) w *= 0.3; // Trail/Berglauf: Umrechnung unsicher

    samples.push({
      timeSec,
      speed: (effKm * 1000) / timeSec,
      rpe: a.rpe != null && a.rpe > 0 ? a.rpe : null,
      hrPct:
        lthr != null && a.avgHr != null && a.avgHr > 60
          ? driftCorrectedHrPct(a.avgHr, lthr, a.durationMin)
          : null,
      w,
      durationMin: a.durationMin,
    });
  }

  // Individuelle HF→Tempo-Kurve: Tempo (relativ zur für die Dauer maximal
  // haltbaren Intensität normiert) gegen %Schwellen-HF.
  const hrPoints = samples
    .filter((s) => s.hrPct != null && s.hrPct >= 0.7 && s.hrPct <= 1.08)
    .map((s) => ({ x: s.hrPct!, y: s.speed, w: s.w }));
  const personalK = personalHrSlope(hrPoints, [0.6, 2.5]);
  const k = personalK ?? HR_SLOPE_RUN;

  const estimates: Estimate[] = [];
  let floor = 0;
  for (const s of samples) {
    const maxI = runMaxIntensity(s.timeSec, exponent);
    floor = Math.max(floor, s.speed / maxI);

    const isMax = (s.rpe != null && s.rpe >= 9) || (s.hrPct != null && s.hrPct >= 0.98 && s.durationMin <= 90);
    if (isMax) {
      estimates.push({ value: s.speed / maxI, weight: 2.5 * s.w, kind: "maxEffort" });
      continue;
    }
    let got = false;
    if (s.hrPct != null && s.hrPct >= 0.7 && s.hrPct <= 1.08) {
      const intensity = 1 + k * (s.hrPct - 1);
      if (intensity > 0.4) {
        const quality = s.hrPct >= 0.85 ? 1 : 0.6;
        estimates.push({ value: s.speed / intensity, weight: quality * s.w, kind: "heartRate" });
        got = true;
      }
    }
    if (s.rpe != null) {
      const intensity = maxI * rpeFraction(s.rpe, RPE_SPEED_FRACTION);
      const quality = s.rpe >= 7 ? 0.8 : s.rpe >= 5 ? 0.55 : 0.35;
      estimates.push({ value: s.speed / intensity, weight: quality * s.w, kind: "rpe" });
      got = true;
    }
    if (!got) {
      // Ohne HF/RPE: typische Trainingsintensität annehmen – schwaches Signal.
      estimates.push({ value: s.speed / (maxI * 0.84), weight: 0.2 * s.w, kind: "volume" });
    }
  }

  for (const r of input.races ?? []) {
    if (!r.completed || r.type !== "run" || !r.resultSeconds) continue;
    const age = ageDays(r.date, today);
    if (age < 0 || age > RACE_WINDOW_DAYS) continue;
    const km = parseRunDistanceKm(r.distance);
    if (!km) continue;
    const speed = (km * 1000) / r.resultSeconds;
    const value = speed / runMaxIntensity(r.resultSeconds, exponent);
    estimates.push({ value, weight: 4 * recencyWeight(age, RACE_HALF_LIFE_DAYS), kind: "race" });
    if (age <= WINDOW_DAYS) floor = Math.max(floor, value);
  }

  if (input.thresholdPaceSecPerKm != null && input.thresholdPaceSecPerKm > 0) {
    estimates.push({ value: 1000 / input.thresholdPaceSecPerKm, weight: 1, kind: "profile" });
  }

  const c = combine(estimates);
  if (!c) return null;
  // Was nachweislich gelaufen wurde, ist die Untergrenze (mit 1 % Toleranz).
  const flooredByBestEffort = floor * 0.99 > c.value;
  const value = flooredByBestEffort ? floor * 0.99 : c.value;

  return {
    value,
    relSpread: c.relSpread,
    samples: samples.length + (input.races ?? []).filter((r) => r.completed && r.type === "run").length,
    sources: c.sources,
    flooredByBestEffort,
    riegelExponent: exponent,
    longestRecentMin,
    personalHrCurve: personalK != null,
  };
}

// ---------------------------------------------------------------------------
// Rad
// ---------------------------------------------------------------------------

export function buildBikeModel(input: PerfInput, lthrRun: number | null): BikeModel | null {
  const today = input.today ?? new Date();
  const lthr = lthrRun != null ? lthrRun * BIKE_LTHR_FACTOR : null;
  const rides = input.activities.filter((a) => a.sport === "bike");

  let longestRecentMin = 0;
  const recent = rides.filter((a) => {
    const age = ageDays(a.date, today);
    if (age < 0 || age > WINDOW_DAYS || !a.durationMin) return false;
    if (age <= 70) longestRecentMin = Math.max(longestRecentMin, a.durationMin);
    return a.durationMin >= 20;
  });

  const withPower = recent.filter((a) => a.avgPower != null && a.avgPower > 50);
  const powerMode = withPower.length >= 2 || (withPower.length >= 1 && input.ftpWatts == null) || input.ftpWatts != null;

  const estimates: Estimate[] = [];
  let floor = 0;
  let personalK: number | null = null;

  if (powerMode) {
    const pts = withPower.map((a) => ({
      timeSec: a.durationMin! * 60,
      power: a.avgPower!,
      rpe: a.rpe != null && a.rpe > 0 ? a.rpe : null,
      hrPct:
        lthr != null && a.avgHr != null && a.avgHr > 60
          ? driftCorrectedHrPct(a.avgHr, lthr, a.durationMin!)
          : null,
      w: recencyWeight(ageDays(a.date, today), HALF_LIFE_DAYS),
      durationMin: a.durationMin!,
    }));
    personalK = personalHrSlope(
      pts
        .filter((p) => p.hrPct != null && p.hrPct >= 0.65 && p.hrPct <= 1.08)
        .map((p) => ({ x: p.hrPct!, y: p.power, w: p.w })),
      [1.0, 4.0],
    );
    const k = personalK ?? HR_SLOPE_BIKE_POWER;

    for (const p of pts) {
      const maxI = bikeMaxPowerIntensity(p.timeSec);
      // Ø-Leistung unterschätzt variable Fahrten → Untergrenze nur bis 90 min.
      if (p.durationMin <= 90) floor = Math.max(floor, p.power / maxI);
      const isMax = (p.rpe != null && p.rpe >= 9) || (p.hrPct != null && p.hrPct >= 0.98 && p.durationMin <= 90);
      if (isMax) {
        estimates.push({ value: p.power / maxI, weight: 2.5 * p.w, kind: "maxEffort" });
        continue;
      }
      let got = false;
      if (p.hrPct != null && p.hrPct >= 0.65 && p.hrPct <= 1.08) {
        const intensity = 1 + k * (p.hrPct - 1);
        if (intensity > 0.35) {
          estimates.push({ value: p.power / intensity, weight: (p.hrPct >= 0.85 ? 1 : 0.6) * p.w, kind: "heartRate" });
          got = true;
        }
      }
      if (p.rpe != null) {
        const intensity = maxI * rpeFraction(p.rpe, RPE_POWER_FRACTION);
        estimates.push({ value: p.power / intensity, weight: (p.rpe >= 7 ? 0.8 : p.rpe >= 5 ? 0.55 : 0.35) * p.w, kind: "rpe" });
        got = true;
      }
      if (!got) {
        estimates.push({ value: p.power / (maxI * 0.72), weight: 0.2 * p.w, kind: "volume" });
      }
    }
    if (input.ftpWatts != null && input.ftpWatts > 0) {
      estimates.push({ value: input.ftpWatts, weight: 1.5, kind: "profile" });
    }
  } else {
    // Ohne Leistungsmesser: Schwellengeschwindigkeit (km/h) aus Tempo + HF/RPE.
    const pts = recent
      .filter((a) => a.distanceKm && a.distanceKm > 3)
      .map((a) => {
        const gain = Math.max(0, a.elevationGainM ?? 0);
        // Höhenmeter kosten auf dem Rad viel Zeit: ~100 Hm ≈ 1 km Flachstrecke.
        const effKm = a.distanceKm! + gain * 0.01;
        return {
          timeSec: a.durationMin! * 60,
          speed: effKm / (a.durationMin! / 60),
          rpe: a.rpe != null && a.rpe > 0 ? a.rpe : null,
          hrPct:
            lthr != null && a.avgHr != null && a.avgHr > 60
              ? driftCorrectedHrPct(a.avgHr, lthr, a.durationMin!)
              : null,
          w: recencyWeight(ageDays(a.date, today), HALF_LIFE_DAYS),
          durationMin: a.durationMin!,
        };
      })
      .filter((p) => p.speed >= 10 && p.speed <= 55);
    personalK = personalHrSlope(
      pts
        .filter((p) => p.hrPct != null && p.hrPct >= 0.65 && p.hrPct <= 1.08)
        .map((p) => ({ x: p.hrPct!, y: p.speed, w: p.w })),
      [0.3, 1.5],
    );
    const k = personalK ?? HR_SLOPE_BIKE_SPEED;
    for (const p of pts) {
      const maxI = bikeMaxPowerIntensity(p.timeSec) ** (1 / 3);
      const isMax = (p.rpe != null && p.rpe >= 9) || (p.hrPct != null && p.hrPct >= 0.98 && p.durationMin <= 90);
      if (isMax) {
        estimates.push({ value: p.speed / maxI, weight: 2 * p.w, kind: "maxEffort" });
        continue;
      }
      let got = false;
      if (p.hrPct != null && p.hrPct >= 0.65 && p.hrPct <= 1.08) {
        const intensity = 1 + k * (p.hrPct - 1);
        estimates.push({ value: p.speed / intensity, weight: 0.8 * p.w, kind: "heartRate" });
        got = true;
      }
      if (p.rpe != null) {
        const intensity = maxI * rpeFraction(p.rpe, RPE_POWER_FRACTION) ** (1 / 3);
        estimates.push({ value: p.speed / intensity, weight: 0.5 * p.w, kind: "rpe" });
        got = true;
      }
      if (!got) {
        estimates.push({ value: p.speed / (maxI * 0.72 ** (1 / 3)), weight: 0.2 * p.w, kind: "volume" });
      }
    }
  }

  const c = combine(estimates);
  if (!c) return null;
  const flooredByBestEffort = powerMode && floor * 0.99 > c.value;
  const value = flooredByBestEffort ? floor * 0.99 : c.value;

  // Persönliches Power→Speed-Verhältnis aus flachen Outdoor-Fahrten mit Leistung.
  let speedPerCubeRootW: number | null = null;
  let personalSpeedModel = false;
  if (powerMode) {
    const ratios = withPower
      .filter((a) => a.distanceKm && a.distanceKm > 10)
      .filter((a) => (a.elevationGainM ?? 0) / a.distanceKm! <= 8)
      .map((a) => ({
        r: a.distanceKm! / (a.durationMin! / 60) / a.avgPower! ** (1 / 3),
        w: recencyWeight(ageDays(a.date, today), HALF_LIFE_DAYS),
      }))
      // Rolle/virtuelle Fahrten mit unrealistischem Tempo verwerfen.
      .filter((x) => x.r > 3 && x.r < 9);
    if (ratios.length >= 2) {
      // Obere Hälfte: im Rennen (Aero-Position, Wettkampfmaterial) eher schneller als im Training.
      const sorted = [...ratios].sort((a, b) => b.r - a.r);
      const top = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
      const W = top.reduce((s, x) => s + x.w, 0);
      speedPerCubeRootW = top.reduce((s, x) => s + x.r * x.w, 0) / W;
      personalSpeedModel = true;
    } else {
      speedPerCubeRootW = DEFAULT_BIKE_C;
    }
  }

  return {
    value,
    relSpread: c.relSpread + (powerMode ? 0 : 0.03),
    samples: recent.length,
    sources: c.sources,
    flooredByBestEffort,
    mode: powerMode ? "power" : "speed",
    speedPerCubeRootW,
    personalSpeedModel,
    longestRecentMin,
    personalHrCurve: personalK != null,
  };
}

// ---------------------------------------------------------------------------
// Schwimmen
// ---------------------------------------------------------------------------

export function buildSwimModel(input: PerfInput, lthrRun: number | null): SwimModel | null {
  const today = input.today ?? new Date();
  // Schwimm-HF liegt deutlich unter der Lauf-HF und ist am Handgelenk unzuverlässig.
  const lthr = lthrRun != null ? lthrRun * 0.92 : null;
  const estimates: Estimate[] = [];
  let floor = 0;
  let longestRecentMin = 0;
  let samples = 0;

  for (const a of input.activities) {
    if (a.sport !== "swim") continue;
    const age = ageDays(a.date, today);
    if (age < 0 || age > WINDOW_DAYS) continue;
    if (!a.distanceKm || !a.durationMin) continue;
    if (age <= 70) longestRecentMin = Math.max(longestRecentMin, a.durationMin);
    if (a.distanceKm < 0.3 || a.durationMin < 8) continue;
    const timeSec = a.durationMin * 60;
    const per100 = timeSec / (a.distanceKm * 10);
    if (per100 < 60 || per100 > 240) continue;
    samples++;
    const speed = (a.distanceKm * 1000) / timeSec;
    const w = recencyWeight(age, HALF_LIFE_DAYS) * 0.8; // Pausen in Ø-Tempo enthalten
    const maxI = swimMaxIntensity(timeSec);
    floor = Math.max(floor, speed / maxI);
    const rpe = a.rpe != null && a.rpe > 0 ? a.rpe : null;
    if (rpe != null && rpe >= 9) {
      estimates.push({ value: speed / maxI, weight: 2 * w, kind: "maxEffort" });
      continue;
    }
    let got = false;
    if (rpe != null) {
      estimates.push({ value: speed / (maxI * rpeFraction(rpe, RPE_SPEED_FRACTION)), weight: (rpe >= 7 ? 0.8 : 0.5) * w, kind: "rpe" });
      got = true;
    }
    if (lthr != null && a.avgHr != null && a.avgHr > 60) {
      const hrPct = a.avgHr / lthr;
      if (hrPct >= 0.7 && hrPct <= 1.1) {
        estimates.push({ value: speed / (1 + HR_SLOPE_SWIM * (hrPct - 1)), weight: 0.35 * w, kind: "heartRate" });
        got = true;
      }
    }
    if (!got) {
      estimates.push({ value: speed / (maxI * 0.88), weight: 0.3 * w, kind: "volume" });
    }
  }
  if (input.cssPer100m != null && input.cssPer100m > 0) {
    estimates.push({ value: 100 / input.cssPer100m, weight: 1.5, kind: "profile" });
  }

  const c = combine(estimates);
  if (!c) return null;
  const flooredByBestEffort = floor * 0.99 > c.value;
  return {
    value: flooredByBestEffort ? floor * 0.99 : c.value,
    relSpread: c.relSpread,
    samples,
    sources: c.sources,
    flooredByBestEffort,
    longestRecentMin,
  };
}

// ---------------------------------------------------------------------------
// Gesamtmodell
// ---------------------------------------------------------------------------

export function buildPerformanceModel(input: PerfInput): PerformanceModel {
  const today = input.today ?? new Date();
  const { lthr, estimated } = resolveThresholdHr(input.activities, input.thresholdHr, today);
  const withToday = { ...input, today };
  return {
    run: buildRunModel(withToday, lthr),
    bike: buildBikeModel(withToday, lthr),
    swim: buildSwimModel(withToday, lthr),
    thresholdHr: lthr,
    thresholdHrEstimated: estimated,
  };
}

// ---------------------------------------------------------------------------
// Prognosen
// ---------------------------------------------------------------------------

function corridorFrom(likely: number, relU: number): Corridor {
  // Leicht asymmetrisch: nach hinten raus geht im Rennen mehr schief als nach vorne.
  return {
    fastSec: Math.round(likely * (1 - relU)),
    likelySec: Math.round(likely),
    slowSec: Math.round(likely * (1 + 1.25 * relU)),
  };
}

function confidenceOf(relU: number): Confidence {
  return relU <= 0.035 ? "hoch" : relU <= 0.06 ? "mittel" : "niedrig";
}

/**
 * Ausdauer-Abdeckung: Wer für ein langes Rennen in den letzten Wochen keine
 * annähernd langen Einheiten absolviert hat, verliert hinten raus Tempo.
 * Liefert Zeitaufschlag (relativ) und zusätzliche Unsicherheit.
 */
function durabilityPenalty(
  raceMin: number,
  longestRecentMin: number,
  maxPenalty: number,
): { penalty: number; extraU: number } {
  if (raceMin <= 75) return { penalty: 0, extraU: 0 };
  const required = Math.min(raceMin * 0.75, 180);
  const coverage = clamp(longestRecentMin / required, 0, 1);
  const penalty = maxPenalty * (1 - coverage);
  return { penalty, extraU: penalty / 2 };
}

/** Laufzeit-Korridor für eine Distanz (optional als Triathlon-Lauf nach dem Rad). */
export function forecastRun(
  distanceKm: number,
  model: RunModel,
  opts: { afterBikeFactor?: number } = {},
): { corridor: Corridor; relU: number; notes: string[] } {
  const refKm = (model.value * 3600) / 1000;
  const baseSec = 3600 * (distanceKm / refKm) ** model.riegelExponent;
  const notes: string[] = [];
  const { penalty, extraU } = durabilityPenalty(baseSec / 60, model.longestRecentMin, 0.1);
  if (penalty >= 0.01) {
    notes.push(
      `Längster Lauf zuletzt ${Math.round(model.longestRecentMin)} min – Ausdauer-Abschlag ${Math.round(penalty * 100)} %.`,
    );
  }
  const likely = baseSec * (1 + penalty) * (opts.afterBikeFactor ?? 1);
  const extrapolation = 0.012 * Math.abs(Math.log(baseSec / 3600));
  const relU = Math.sqrt(
    model.relSpread ** 2 + extrapolation ** 2 + extraU ** 2 + DAY_FORM_SPREAD ** 2 +
      (opts.afterBikeFactor ? 0.02 ** 2 : 0),
  );
  return { corridor: corridorFrom(likely, relU), relU, notes };
}

export function forecastRunDistances(model: RunModel): RunForecast[] {
  return RUN_DISTANCES.map((d) => {
    const { corridor, relU, notes } = forecastRun(d.km, model);
    return {
      key: d.key,
      label: d.label,
      distanceKm: d.km,
      corridor,
      pace: {
        fastSec: Math.round(corridor.fastSec / d.km),
        likelySec: Math.round(corridor.likelySec / d.km),
        slowSec: Math.round(corridor.slowSec / d.km),
      },
      confidence: confidenceOf(relU),
      notes,
    };
  });
}

function forecastBike(
  distanceKm: number,
  intensityFactor: number,
  model: BikeModel,
): { corridor: Corridor; relU: number; watts: number | null; kmh: number; notes: string[] } {
  const notes: string[] = [];
  let kmh: number;
  let watts: number | null = null;
  let relU: number;
  if (model.mode === "power") {
    watts = model.value * intensityFactor;
    kmh = (model.speedPerCubeRootW ?? DEFAULT_BIKE_C) * watts ** (1 / 3);
    // Kapazität geht mit ^1/3 in die Geschwindigkeit ein.
    relU = Math.sqrt((model.relSpread / 3) ** 2 + (model.personalSpeedModel ? 0.03 : 0.06) ** 2);
    if (!model.personalSpeedModel) notes.push("Tempo aus generischem Power-Speed-Modell (flach, TT-Position).");
  } else {
    kmh = model.value * intensityFactor ** (1 / 3);
    relU = Math.sqrt(model.relSpread ** 2 + 0.03 ** 2);
    notes.push("Ohne Leistungsmesser aus Geschwindigkeit geschätzt – streckenabhängig.");
  }
  const baseSec = (distanceKm / kmh) * 3600;
  const { penalty, extraU } = durabilityPenalty(baseSec / 60, model.longestRecentMin, 0.06);
  if (penalty >= 0.01) {
    notes.push(`Längste Radeinheit zuletzt ${Math.round(model.longestRecentMin)} min – Ausdauer-Abschlag ${Math.round(penalty * 100)} %.`);
  }
  relU = Math.sqrt(relU ** 2 + extraU ** 2 + DAY_FORM_SPREAD ** 2);
  return {
    corridor: corridorFrom(baseSec * (1 + penalty), relU),
    relU,
    watts: watts != null ? Math.round(watts) : null,
    kmh: Math.round((kmh / (1 + penalty)) * 10) / 10,
    notes,
  };
}

function forecastSwim(
  distanceM: number,
  factor: number,
  model: SwimModel,
): { corridor: Corridor; relU: number; notes: string[] } {
  const baseSec = (distanceM / model.value) * factor;
  const notes: string[] = [];
  const { penalty, extraU } = durabilityPenalty(baseSec / 60, model.longestRecentMin, 0.05);
  if (penalty >= 0.01) {
    notes.push(`Längste Schwimmeinheit zuletzt ${Math.round(model.longestRecentMin)} min – Ausdauer-Abschlag ${Math.round(penalty * 100)} %.`);
  }
  // Freiwasser (Orientierung, Neo, Wellen) streut stärker als das Becken.
  const relU = Math.sqrt(model.relSpread ** 2 + extraU ** 2 + 0.03 ** 2);
  return { corridor: corridorFrom(baseSec * (1 + penalty), relU), relU, notes };
}

/** Summiert Teil-Korridore; Abweichungen werden quadratisch addiert (nicht alles geht gleichzeitig schief). */
function sumCorridors(parts: Corridor[], fixedSec: number): Corridor {
  const likely = parts.reduce((s, p) => s + p.likelySec, 0) + fixedSec;
  const down = Math.sqrt(parts.reduce((s, p) => s + (p.likelySec - p.fastSec) ** 2, 0));
  const up = Math.sqrt(parts.reduce((s, p) => s + (p.slowSec - p.likelySec) ** 2, 0));
  return {
    fastSec: Math.round(likely - down),
    likelySec: Math.round(likely),
    slowSec: Math.round(likely + up + fixedSec * 0.25),
  };
}

export function forecastTriathlon(tri: TriProfile, model: PerformanceModel): TriForecast {
  const notes: string[] = [];
  const swim = model.swim ? forecastSwim(tri.swimM, tri.swimFactor, model.swim) : null;
  const bike = model.bike ? forecastBike(tri.bikeKm, tri.bikeIF, model.bike) : null;
  const run = model.run ? forecastRun(tri.runKm, model.run, { afterBikeFactor: tri.runPenalty }) : null;
  for (const n of [...(swim?.notes ?? []), ...(bike?.notes ?? []), ...(run?.notes ?? [])]) {
    if (!notes.includes(n)) notes.push(n);
  }
  const legs = [swim, bike, run];
  const complete = legs.every((l) => l != null);
  const total = complete ? sumCorridors(legs.map((l) => l!.corridor), tri.transitionSec) : null;
  const worstU = Math.max(...legs.map((l) => l?.relU ?? 0.1));
  const perUnit = (c: Corridor, units: number): Corridor => ({
    fastSec: Math.round(c.fastSec / units),
    likelySec: Math.round(c.likelySec / units),
    slowSec: Math.round(c.slowSec / units),
  });
  return {
    key: tri.key,
    label: tri.label,
    swim: swim?.corridor ?? null,
    bike: bike?.corridor ?? null,
    run: run?.corridor ?? null,
    transitionSec: tri.transitionSec,
    total,
    bikeTarget: bike ? { watts: bike.watts, kmh: bike.kmh } : null,
    runPaceSecPerKm: run ? perUnit(run.corridor, tri.runKm) : null,
    swimPacePer100m: swim ? perUnit(swim.corridor, tri.swimM / 100) : null,
    confidence: complete ? confidenceOf(worstU) : "niedrig",
    notes,
  };
}

export function forecastTriathlons(model: PerformanceModel): TriForecast[] {
  return TRI_DISTANCES.map((t) => forecastTriathlon(t, model));
}

/** Ordnet einen geplanten Wettkampf einer Prognose zu. */
export function forecastRace(
  type: string,
  distance: string | null,
  model: PerformanceModel,
): { label: string; corridor: Corridor; confidence: Confidence } | null {
  const d = (distance ?? "").toLowerCase().trim();
  if (type === "triathlon") {
    const tri = d ? TRI_DISTANCES.find((t) => t.key === d || t.label.toLowerCase().includes(d)) : undefined;
    if (!tri) return null;
    const f = forecastTriathlon(tri, model);
    return f.total ? { label: tri.label, corridor: f.total, confidence: f.confidence } : null;
  }
  if (type === "run" && model.run) {
    const km = parseRunDistanceKm(distance);
    if (!km) return null;
    const known = RUN_DISTANCES.find((r) => Math.abs(r.km - km) < 0.01);
    const { corridor, relU } = forecastRun(km, model.run);
    return {
      label: known?.label ?? `${km.toLocaleString("de-DE")} km`,
      corridor,
      confidence: confidenceOf(relU),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Anzeige-Helfer
// ---------------------------------------------------------------------------

export const SOURCE_LABELS: Record<SourceKind, string> = {
  race: "Wettkampfergebnisse",
  maxEffort: "harte Einheiten",
  heartRate: "Herzfrequenz",
  rpe: "RPE",
  volume: "Tempo ohne HF/RPE",
  profile: "Profilwert",
};

/** Kapazität als lesbarer Text (z.B. "Schwelle 4:21 /km"). */
export function describeCapacity(sport: "run" | "bike" | "swim", model: CapacityEstimate & { mode?: string }): string {
  if (sport === "run") return `Schwellentempo ${formatPace(1000 / model.value)} /km`;
  if (sport === "swim") return `CSS ${formatPace(100 / model.value)} /100 m`;
  return model.mode === "speed"
    ? `Schwellentempo ${model.value.toFixed(1)} km/h`
    : `FTP ≈ ${Math.round(model.value)} W`;
}

function formatPace(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Mapping aus gespeicherten Aktivitäten
// ---------------------------------------------------------------------------

/** Mappt eine gespeicherte Aktivität (Prisma-Zeile) auf die Modell-Eingabe. */
export function perfActivityFromRow(row: {
  date: Date | string;
  sport: string;
  durationMin: number | null;
  distanceKm: number | null;
  avgHr: number | null;
  avgPower: number | null;
  rpe: number | null;
  maxHr?: number | null;
  elevationGainM?: number | null;
}): PerfActivity {
  return {
    date: row.date,
    sport: row.sport,
    durationMin: row.durationMin,
    distanceKm: row.distanceKm,
    avgHr: row.avgHr,
    avgPower: row.avgPower,
    rpe: row.rpe,
    maxHr: row.maxHr ?? null,
    elevationGainM: row.elevationGainM ?? null,
  };
}
