/**
 * VO2max-/VDOT-Schätzung aus einer Laufleistung (rein/testbar).
 *
 * Verwendet Jack Daniels' VDOT-Modell: aus Distanz (m) und Zeit (s) wird die
 * Geschwindigkeit (m/min) abgeleitet, daraus VO2 (Sauerstoffaufnahme bei dieser
 * Pace) und der prozentuale VO2max-Anteil (intensitätsabhängig). VDOT ≈
 * VO2 / %VO2max. Die Zahl ist ein bewährter, gut vergleichbarer Fitness-Index.
 */

export interface VdotResult {
  /** VDOT-Index (≈ effektiver VO2max). */
  vdot: number;
  /** Geschätzter VO2max in ml/kg/min (hier gleich VDOT gesetzt). */
  vo2max: number;
}

/**
 * Schätzt VDOT/VO2max aus einer Laufleistung.
 * @param distanceM Distanz in Metern (z. B. 5000)
 * @param timeSec   Zeit in Sekunden
 */
export function estimateVdot(distanceM: number, timeSec: number): VdotResult | null {
  if (distanceM <= 0 || timeSec <= 0) return null;
  const timeMin = timeSec / 60;
  const velocity = distanceM / timeMin; // m/min

  // VO2 bei Wettkampf-Pace (Daniels).
  const vo2 = -4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity;

  // Anteil des VO2max, der über die Renndauer gehalten wird (Drop-Dead-Kurve).
  const pctMax =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMin) +
    0.2989558 * Math.exp(-0.1932605 * timeMin);

  const vdot = vo2 / pctMax;
  if (!Number.isFinite(vdot) || vdot <= 0) return null;
  const rounded = Math.round(vdot * 10) / 10;
  return { vdot: rounded, vo2max: rounded };
}

/** Grobe Leistungs-Einordnung des VDOT (Freizeit … Elite) für die Anzeige. */
export function vdotCategory(vdot: number): string {
  if (vdot < 35) return "Einsteiger";
  if (vdot < 45) return "ambitioniert";
  if (vdot < 55) return "fortgeschritten";
  if (vdot < 65) return "Wettkampf";
  return "Elite";
}
