/**
 * Trainingszonen (rein/testbar).
 *
 * Power-Zonen nach Coggan (% FTP), Herzfrequenz-Zonen nach Friel (% Schwellen-HF)
 * und Lauf-Pace-Zonen relativ zur Schwellen-Pace. Werte sind Richtwerte und
 * dienen als Referenz – die sportwissenschaftliche Feinjustierung bleibt beim
 * Coach/LLM.
 */

export interface Zone {
  id: string;
  name: string;
  /** Untergrenze in der jeweiligen Einheit (null = offen nach unten). */
  lo: number | null;
  /** Obergrenze (null = offen nach oben). */
  hi: number | null;
  color: string;
}

// Ruhig abgestufte Zonen-Palette (grau → blau → grün → amber → rot).
const PALETTE = [
  "#8e8e93",
  "#0a84ff",
  "#30b0c7",
  "#34c759",
  "#ff9f0a",
  "#ff6b22",
  "#ff3b30",
];

/** Power-Zonen (Coggan, % der FTP) in Watt. */
export function computePowerZones(ftp: number): Zone[] {
  const w = (pct: number) => Math.round((ftp * pct) / 100);
  return [
    { id: "z1", name: "Z1 · Recovery", lo: 0, hi: w(55), color: PALETTE[0] },
    { id: "z2", name: "Z2 · Grundlage", lo: w(56), hi: w(75), color: PALETTE[1] },
    { id: "z3", name: "Z3 · Tempo", lo: w(76), hi: w(90), color: PALETTE[2] },
    { id: "z4", name: "Z4 · Schwelle", lo: w(91), hi: w(105), color: PALETTE[3] },
    { id: "z5", name: "Z5 · VO2max", lo: w(106), hi: w(120), color: PALETTE[4] },
    { id: "z6", name: "Z6 · Anaerob", lo: w(121), hi: w(150), color: PALETTE[5] },
    { id: "z7", name: "Z7 · Neuromuskulär", lo: w(151), hi: null, color: PALETTE[6] },
  ];
}

/** Herzfrequenz-Zonen (Friel, % der Schwellen-HF / LTHR) in bpm. */
export function computeHrZones(lthr: number): Zone[] {
  const b = (pct: number) => Math.round((lthr * pct) / 100);
  return [
    { id: "z1", name: "Z1 · Recovery", lo: 0, hi: b(80), color: PALETTE[0] },
    { id: "z2", name: "Z2 · Aerob", lo: b(81), hi: b(89), color: PALETTE[1] },
    { id: "z3", name: "Z3 · Tempo", lo: b(90), hi: b(93), color: PALETTE[3] },
    { id: "z4", name: "Z4 · Schwelle", lo: b(94), hi: b(99), color: PALETTE[4] },
    { id: "z5", name: "Z5 · VO2max", lo: b(100), hi: null, color: PALETTE[6] },
  ];
}

/**
 * Lauf-Pace-Zonen relativ zur Schwellen-Pace (Sekunden pro km).
 * `lo` ist die schnellere (kleinere) Sekundenzahl, `hi` die langsamere.
 */
export function computePaceZones(thresholdSecPerKm: number): Zone[] {
  const p = (factor: number) => Math.round(thresholdSecPerKm * factor);
  return [
    { id: "z1", name: "Z1 · Recovery", lo: p(1.18), hi: null, color: PALETTE[0] },
    { id: "z2", name: "Z2 · Grundlage", lo: p(1.1), hi: p(1.18), color: PALETTE[1] },
    { id: "z3", name: "Z3 · Tempo", lo: p(1.04), hi: p(1.1), color: PALETTE[3] },
    { id: "z4", name: "Z4 · Schwelle", lo: p(0.98), hi: p(1.04), color: PALETTE[4] },
    { id: "z5", name: "Z5 · Intervalle", lo: 0, hi: p(0.98), color: PALETTE[6] },
  ];
}

/** Formatiert Sekunden/km als m:ss. */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
