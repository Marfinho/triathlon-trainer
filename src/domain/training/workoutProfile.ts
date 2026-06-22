import {
  resolveSegmentWatts,
  type ResolvableSegment,
} from "@/integrations/trainer/watts";

/**
 * Wandelt die Segmente eines geplanten Workouts in ein grafisches Profil
 * (Balken über die Zeit) um – „was erwartet mich?". Rein/testbar.
 *
 * Pro Segment wird die Ziel-Intensität als Anteil der FTP bestimmt
 * (`resolveSegmentWatts` deckt Power-, Zonen-, RPE- und Default-Fälle ab) und
 * die Breite aus der Dauer (Fallback: Distanz, sonst gleichgewichtet). Die
 * Darstellung ist sportartübergreifend sinnvoll, weil sie relative Intensität
 * zeigt – die Watt-Angabe ist v. a. fürs Rad relevant.
 */

export interface ProfileSegmentInput extends ResolvableSegment {
  durationSec?: number | null;
  distanceM?: number | null;
  description?: string | null;
  cadenceNote?: string | null;
}

export interface ProfileBar {
  /** Relative Breite des Balkens (Summe aller Breiten ergibt Gesamt). */
  weight: number;
  durationSec: number | null;
  distanceM: number | null;
  /** Ziel-Intensität als Anteil der FTP (z. B. 0.95 = 95 %). */
  pctFtp: number;
  /** Aufgelöste Ziel-Watt. */
  watts: number;
  type: string;
  label: string;
  color: string;
  description: string | null;
  cadenceNote: string | null;
  rpeTarget: number | null;
}

const TYPE_LABEL: Record<string, string> = {
  warmup: "Aufwärmen",
  steady: "Konstant",
  interval: "Intervall",
  recovery: "Erholung",
  tempo: "Tempo",
  threshold: "Schwelle",
  vo2max: "VO2max",
  sprint: "Sprint",
  drill: "Technik",
  cooldown: "Ausfahren",
  rest: "Pause",
  other: "Segment",
};

export function segmentTypeLabel(type: string | null | undefined): string {
  return (type && TYPE_LABEL[type]) || "Segment";
}

// Farbskala nach %FTP – an den Coggan-Power-Zonengrenzen orientiert.
export function zoneColorForPct(pctFtp: number): string {
  if (pctFtp < 0.56) return "#8e8e93"; // Z1 Recovery
  if (pctFtp < 0.76) return "#0a84ff"; // Z2 Grundlage
  if (pctFtp < 0.91) return "#30b0c7"; // Z3 Tempo
  if (pctFtp < 1.06) return "#34c759"; // Z4 Schwelle
  if (pctFtp < 1.21) return "#ff9f0a"; // Z5 VO2max
  return "#ff3b30"; // Z6+ anaerob/Sprint
}

export function buildWorkoutProfile(
  segments: ProfileSegmentInput[],
  opts: { ftp: number },
): ProfileBar[] {
  const ftp = opts.ftp > 0 ? opts.ftp : 200;
  return segments.map((s) => {
    const { target } = resolveSegmentWatts(s, { ftp });
    const pctFtp = Math.round((target / ftp) * 100) / 100;
    const weight =
      typeof s.durationSec === "number" && s.durationSec > 0
        ? s.durationSec
        : typeof s.distanceM === "number" && s.distanceM > 0
          ? s.distanceM
          : 60;
    return {
      weight,
      durationSec: s.durationSec ?? null,
      distanceM: s.distanceM ?? null,
      pctFtp,
      watts: target,
      type: s.type ?? "other",
      label: segmentTypeLabel(s.type),
      color: zoneColorForPct(pctFtp),
      description: s.description ?? null,
      cadenceNote: s.cadenceNote ?? null,
      rpeTarget: s.rpeTarget ?? null,
    };
  });
}

export interface ProfileSummary {
  /** Gesamtdauer in Sekunden (nur Segmente mit Dauer). */
  totalSec: number;
  /** Intensitätsfaktor: dauergewichteter Ø-Anteil der FTP. */
  intensityFactor: number;
  /** Geschätzte Trainingsbelastung (TSS-Stil) aus dem Profil. */
  tss: number;
  /** Mechanische Arbeit in kJ (v. a. Rad). */
  kJ: number;
}

/**
 * Verdichtet ein Profil zu Eckwerten (Gesamtdauer, IF, geschätzte TSS, Arbeit).
 * TSS = Σ (Dauer_h · IF_seg²) · 100; IF = dauergewichteter Ø-%FTP. Segmente ohne
 * Dauer fließen nur in die Arbeit/IF-Gewichtung ein, soweit sie Dauer haben.
 */
export function summarizeProfile(bars: ProfileBar[], ftp: number): ProfileSummary {
  const safeFtp = ftp > 0 ? ftp : 200;
  let totalSec = 0;
  let weightedPctSum = 0;
  let tss = 0;
  let joules = 0;
  for (const b of bars) {
    const sec = typeof b.durationSec === "number" && b.durationSec > 0 ? b.durationSec : 0;
    if (sec > 0) {
      totalSec += sec;
      weightedPctSum += b.pctFtp * sec;
      tss += (sec / 3600) * b.pctFtp * b.pctFtp * 100;
      joules += b.watts * sec;
    }
  }
  const intensityFactor =
    totalSec > 0 ? Math.round((weightedPctSum / totalSec) * 100) / 100 : 0;
  return {
    totalSec,
    intensityFactor,
    tss: Math.round(tss),
    kJ: Math.round(joules / 1000),
  };
}
