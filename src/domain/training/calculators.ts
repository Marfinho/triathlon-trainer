/**
 * Kleine Trainings-Rechner (rein/testbar).
 */

/**
 * Critical Swim Speed (CSS) aus einem 400 m- und 200 m-Testschwimmen.
 * CSS-Geschwindigkeit = (400 − 200) m / (t400 − t200) s; daraus Pace je 100 m.
 * Ergebnis: Sekunden je 100 m.
 */
export function cssFromTimeTrials(
  t400Sec: number,
  t200Sec: number,
): number | null {
  const dt = t400Sec - t200Sec;
  if (dt <= 0) return null;
  // 200 m in dt Sekunden -> pro 100 m = dt / 2.
  return Math.round((dt / 2) * 10) / 10;
}

/** Pace (Sekunden/km) -> Geschwindigkeit (km/h). */
export function paceToSpeed(secPerKm: number): number {
  if (secPerKm <= 0) return 0;
  return Math.round((3600 / secPerKm) * 100) / 100;
}

/** Geschwindigkeit (km/h) -> Pace (Sekunden/km). */
export function speedToPace(kmh: number): number {
  if (kmh <= 0) return 0;
  return Math.round(3600 / kmh);
}

/** Parst "h:mm:ss" / "mm:ss" / "ss" zu Sekunden. */
export function parseClock(str: string): number | null {
  const parts = str.split(":").map((p) => Number(p.trim()));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

/** Formatiert Sekunden als m:ss. */
export function formatClock(sec: number): string {
  let m = Math.floor(sec / 60);
  let s = Math.round(sec % 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
