/**
 * Auswertung einer aufgezeichneten Rollen-Einheit (rein/testbar).
 *
 * Berechnet aus 1-Hz-Samples die üblichen Kennzahlen: Durchschnittsleistung,
 * Normalized Power (NP), Intensity Factor (IF), Trainingsbelastung (TSS),
 * verrichtete Arbeit (kJ) sowie Durchschnitts-Cadence/-HF und die geschätzte
 * Distanz aus der Geschwindigkeit.
 */

export interface RideSample {
  /** Sekunden seit Start. */
  tSec: number;
  powerW?: number | null;
  cadenceRpm?: number | null;
  hrBpm?: number | null;
  speedKmh?: number | null;
  targetW?: number | null;
}

export interface RideSummary {
  durationSec: number;
  samples: number;
  avgPowerW: number | null;
  maxPowerW: number | null;
  normalizedPowerW: number | null;
  intensityFactor: number | null;
  tss: number | null;
  kiloJoules: number | null;
  avgCadenceRpm: number | null;
  avgHrBpm: number | null;
  maxHrBpm: number | null;
  distanceKm: number | null;
}

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/** Normalized Power: 30 s gleitender Mittelwert, dann 4.-Potenz-Mittel. */
export function normalizedPower(powerPerSecond: number[]): number | null {
  if (powerPerSecond.length === 0) return null;
  const window = 30;
  const rolling: number[] = [];
  for (let i = 0; i < powerPerSecond.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = powerPerSecond.slice(start, i + 1);
    rolling.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  const fourth = rolling.reduce((a, b) => a + b ** 4, 0) / rolling.length;
  return Math.round(Math.pow(fourth, 0.25));
}

export function summarizeRide(
  samples: RideSample[],
  opts: { ftp: number },
): RideSummary {
  const durationSec = samples.length;
  if (durationSec === 0) {
    return {
      durationSec: 0,
      samples: 0,
      avgPowerW: null,
      maxPowerW: null,
      normalizedPowerW: null,
      intensityFactor: null,
      tss: null,
      kiloJoules: null,
      avgCadenceRpm: null,
      avgHrBpm: null,
      maxHrBpm: null,
      distanceKm: null,
    };
  }

  // Für NP/Arbeit wird die Leistung pro Sekunde benötigt (fehlend = 0).
  const powerPerSec = samples.map((s) =>
    typeof s.powerW === "number" && s.powerW >= 0 ? s.powerW : 0,
  );
  const powersPresent = samples
    .map((s) => s.powerW)
    .filter((v): v is number => typeof v === "number" && v >= 0);
  const cadences = samples
    .map((s) => s.cadenceRpm)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const hrs = samples
    .map((s) => s.hrBpm)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const speeds = samples.map((s) =>
    typeof s.speedKmh === "number" && s.speedKmh >= 0 ? s.speedKmh : 0,
  );

  const avgPower = avg(powersPresent);
  const np = powersPresent.length ? normalizedPower(powerPerSec) : null;
  const intensityFactor =
    np != null && opts.ftp > 0 ? Math.round((np / opts.ftp) * 1000) / 1000 : null;
  const tss =
    np != null && intensityFactor != null && opts.ftp > 0
      ? Math.round(
          ((durationSec * np * intensityFactor) / (opts.ftp * 3600)) * 100,
        )
      : null;
  // Arbeit (kJ) ≈ Summe der Watt-Sekunden / 1000 (1 W·s = 1 J).
  const joules = powerPerSec.reduce((a, b) => a + b, 0);
  const kiloJoules = powersPresent.length ? Math.round(joules / 1000) : null;
  // Distanz aus Geschwindigkeit: km/h * (1/3600) h pro Sekunde.
  const distanceKm =
    speeds.some((v) => v > 0)
      ? Math.round((speeds.reduce((a, b) => a + b, 0) / 3600) * 100) / 100
      : null;

  return {
    durationSec,
    samples: durationSec,
    avgPowerW: avgPower != null ? Math.round(avgPower) : null,
    maxPowerW: powersPresent.length ? Math.max(...powersPresent) : null,
    normalizedPowerW: np,
    intensityFactor,
    tss,
    kiloJoules,
    avgCadenceRpm: cadences.length ? Math.round(avg(cadences)!) : null,
    avgHrBpm: hrs.length ? Math.round(avg(hrs)!) : null,
    maxHrBpm: hrs.length ? Math.max(...hrs) : null,
    distanceKm,
  };
}

/** Reduziert eine Sample-Reihe auf maximal `maxPoints` Werte (für Graphen). */
export function downsample<T>(items: T[], maxPoints: number): T[] {
  if (items.length <= maxPoints) return items;
  const step = items.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(items[Math.floor(i * step)]);
  }
  return out;
}
