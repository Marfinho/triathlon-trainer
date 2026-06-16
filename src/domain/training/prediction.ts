/**
 * Wettkampfzeit-Vorhersage (rein/testbar).
 *
 * Schätzt Renn­zeiten aus den distillierten Trainingsdaten des Athleten:
 *   - Laufen:    Schwellen-Pace + Riegel-Endurance-Formel (T2 = T1·(D2/D1)^1.06)
 *   - Rad:       FTP + intensitätsabhängiger Anteil + Power-Speed-Modell (v∝P^⅓)
 *   - Schwimmen: CSS-Pace (Sekunden/100 m) × distanzabhängiger Faktor
 *
 * Alle Werte sind Schätzungen und ersetzen keine Renn­erfahrung. Annahmen sind
 * bewusst transparent gehalten.
 */

export interface PredictionProfile {
  thresholdPaceSecPerKm: number | null; // Lauf-Schwellenpace
  ftpWatts: number | null;
  cssPer100m: number | null; // Schwimm-Schwelle
  weightKg?: number | null;
  /** Aktuelle Fitness (CTL) – nur als Kontext/Confidence. */
  ctl?: number | null;
}

const RIEGEL_EXP = 1.06;

// Power-Speed-Referenz: flotter age-grouper in TT-Position auf flachem Kurs.
const BIKE_V_REF_KMH = 36;
const BIKE_P_REF_W = 200;

export interface RunDistance {
  key: string;
  label: string;
  km: number;
}

export const RUN_DISTANCES: RunDistance[] = [
  { key: "5k", label: "5 km", km: 5 },
  { key: "10k", label: "10 km", km: 10 },
  { key: "hm", label: "Halbmarathon", km: 21.0975 },
  { key: "m", label: "Marathon", km: 42.195 },
];

export interface TriProfile {
  key: string;
  label: string;
  swimM: number;
  bikeKm: number;
  runKm: number;
  transitionSec: number;
  swimFactor: number; // relativ zur CSS-Pace
  bikeIF: number; // Anteil der FTP
  runPenalty: number; // Lauf nach dem Rad ist langsamer
}

export const TRI_DISTANCES: TriProfile[] = [
  { key: "sprint", label: "Sprint", swimM: 750, bikeKm: 20, runKm: 5, transitionSec: 180, swimFactor: 0.97, bikeIF: 0.88, runPenalty: 1.03 },
  { key: "olympic", label: "Olympisch", swimM: 1500, bikeKm: 40, runKm: 10, transitionSec: 300, swimFactor: 1.0, bikeIF: 0.85, runPenalty: 1.05 },
  { key: "70.3", label: "Mitteldistanz (70.3)", swimM: 1900, bikeKm: 90, runKm: 21.0975, transitionSec: 480, swimFactor: 1.03, bikeIF: 0.8, runPenalty: 1.08 },
  { key: "full", label: "Langdistanz (Ironman)", swimM: 3800, bikeKm: 180, runKm: 42.195, transitionSec: 720, swimFactor: 1.06, bikeIF: 0.7, runPenalty: 1.12 },
];

/** Lauf-Zeit (Sekunden) für eine Distanz via Riegel, ausgehend von der Schwelle. */
export function predictRunTime(
  distanceKm: number,
  thresholdPaceSecPerKm: number,
): number {
  // Schwellenpace ≈ Tempo, das ~1 h gehalten werden kann.
  const refDistKm = 3600 / thresholdPaceSecPerKm;
  return Math.round(3600 * (distanceKm / refDistKm) ** RIEGEL_EXP);
}

/** Rad-Zeit (Sekunden) aus FTP, Intensität und Power-Speed-Modell. */
export function predictBikeTime(
  distanceKm: number,
  ftp: number,
  intensityFactor: number,
): number {
  const power = ftp * intensityFactor;
  const speed = BIKE_V_REF_KMH * (power / BIKE_P_REF_W) ** (1 / 3);
  return Math.round((distanceKm / speed) * 3600);
}

/** Schwimm-Zeit (Sekunden) aus CSS-Pace und Distanzfaktor. */
export function predictSwimTime(
  distanceM: number,
  cssPer100m: number,
  factor: number,
): number {
  return Math.round((distanceM / 100) * cssPer100m * factor);
}

export interface TriPrediction {
  key: string;
  label: string;
  swimSec: number | null;
  bikeSec: number | null;
  runSec: number | null;
  transitionSec: number;
  totalSec: number | null;
  /** Anteil der Legs, die geschätzt werden konnten (0..1). */
  confidence: number;
}

export function predictTriathlon(
  tri: TriProfile,
  profile: PredictionProfile,
): TriPrediction {
  const swimSec =
    profile.cssPer100m != null
      ? predictSwimTime(tri.swimM, profile.cssPer100m, tri.swimFactor)
      : null;
  const bikeSec =
    profile.ftpWatts != null
      ? predictBikeTime(tri.bikeKm, profile.ftpWatts, tri.bikeIF)
      : null;
  const runSec =
    profile.thresholdPaceSecPerKm != null
      ? Math.round(
          predictRunTime(tri.runKm, profile.thresholdPaceSecPerKm) * tri.runPenalty,
        )
      : null;

  const legs = [swimSec, bikeSec, runSec];
  const available = legs.filter((l) => l != null).length;
  const totalSec =
    available === 3
      ? swimSec! + bikeSec! + runSec! + tri.transitionSec
      : null;

  return {
    key: tri.key,
    label: tri.label,
    swimSec,
    bikeSec,
    runSec,
    transitionSec: tri.transitionSec,
    totalSec,
    confidence: available / 3,
  };
}

/** Formatiert Sekunden als h:mm:ss (oder m:ss < 1 h). */
export function formatDuration(sec: number | null): string {
  if (sec == null) return "—";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
    : `${m}:${String(r).padStart(2, "0")}`;
}

/** Pace (Sekunden/km) für eine vorhergesagte Laufzeit. */
export function paceForRun(distanceKm: number, totalSec: number): number {
  return Math.round(totalSec / distanceKm);
}

/** Ordnet eine Wettkampf-Distanzbezeichnung einer Vorhersage zu. */
export function matchRacePrediction(
  type: string,
  distance: string | null,
  profile: PredictionProfile,
): { label: string; totalSec: number | null } | null {
  const d = (distance ?? "").toLowerCase().trim();
  const tri = TRI_DISTANCES.find((t) => t.key === d || t.label.toLowerCase().includes(d));
  if ((type === "triathlon" || tri) && tri) {
    const p = predictTriathlon(tri, profile);
    return { label: tri.label, totalSec: p.totalSec };
  }
  const run = RUN_DISTANCES.find((r) => r.key === d || r.label.toLowerCase() === d);
  if (run && profile.thresholdPaceSecPerKm != null) {
    return {
      label: run.label,
      totalSec: predictRunTime(run.km, profile.thresholdPaceSecPerKm),
    };
  }
  return null;
}
