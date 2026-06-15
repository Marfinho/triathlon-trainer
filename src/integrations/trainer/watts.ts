/**
 * Auflösung von Ziel-Watt aus einem Workout-Segment für die ERG-Steuerung.
 *
 * Priorität:
 *   1. Explizites Power-Target (targetType === "power") -> Watt direkt.
 *   2. Zone aus Segmenttyp/Intensität -> %FTP.
 *   3. RPE-Ziel -> %FTP.
 *   4. Default (Grundlage).
 *
 * Rein/testbar. FTP wird als Parameter übergeben.
 */

export interface ResolvableSegment {
  type?: string | null;
  intensity?: string | null;
  targetType?: string | null;
  targetValue?: number | null;
  targetValueTo?: number | null;
  rpeTarget?: number | null;
}

/** Zone -> Anteil an FTP. */
export const ZONE_FTP_RATIO: Record<string, number> = {
  recovery: 0.5,
  easy: 0.55,
  warmup: 0.55,
  cooldown: 0.55,
  endurance: 0.65,
  steady: 0.65,
  tempo: 0.8,
  threshold: 0.95,
  interval: 1.1,
  vo2max: 1.1,
  sprint: 1.3,
  rest: 0,
};

/** RPE (1–10) -> Anteil an FTP. */
export const RPE_FTP_RATIO: Record<number, number> = {
  1: 0.5,
  2: 0.55,
  3: 0.65,
  4: 0.72,
  5: 0.8,
  6: 0.88,
  7: 0.95,
  8: 1.05,
  9: 1.15,
  10: 1.3,
};

const DEFAULT_RATIO = 0.6;

export interface ResolvedWatts {
  /** Ziel-Watt für ERG (gerundet). */
  target: number;
  /** Optionaler Zielbereich [min, max], falls bekannt. */
  range?: [number, number];
  /** Woraus der Wert abgeleitet wurde. */
  source: "power" | "zone" | "rpe" | "default";
}

export function resolveSegmentWatts(
  segment: ResolvableSegment,
  opts: { ftp: number },
): ResolvedWatts {
  const ftp = opts.ftp;

  // 1. Explizites Power-Target.
  if (
    segment.targetType === "power" &&
    typeof segment.targetValue === "number"
  ) {
    const target = Math.round(segment.targetValue);
    if (typeof segment.targetValueTo === "number") {
      const hi = Math.round(segment.targetValueTo);
      return {
        target: Math.round((target + hi) / 2),
        range: [target, hi],
        source: "power",
      };
    }
    return { target, source: "power" };
  }

  // 2. Zone aus Segmenttyp oder Intensität.
  const zoneKey =
    (segment.intensity && ZONE_FTP_RATIO[segment.intensity] !== undefined
      ? segment.intensity
      : undefined) ??
    (segment.type && ZONE_FTP_RATIO[segment.type] !== undefined
      ? segment.type
      : undefined);
  if (zoneKey) {
    return {
      target: Math.round(ftp * ZONE_FTP_RATIO[zoneKey]),
      source: "zone",
    };
  }

  // 3. RPE-Ziel.
  if (
    typeof segment.rpeTarget === "number" &&
    RPE_FTP_RATIO[segment.rpeTarget] !== undefined
  ) {
    return {
      target: Math.round(ftp * RPE_FTP_RATIO[segment.rpeTarget]),
      source: "rpe",
    };
  }

  // 4. Default.
  return { target: Math.round(ftp * DEFAULT_RATIO), source: "default" };
}
