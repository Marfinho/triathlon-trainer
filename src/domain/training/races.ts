import { parseIsoDate, diffInDays } from "./dates";

/** Tage bis zum Rennen (negativ = vergangen). */
export function daysUntilRace(dateIso: string, today: Date = new Date()): number {
  const todayMidnight = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  );
  return diffInDays(todayMidnight, parseIsoDate(dateIso.slice(0, 10)));
}

/** Menschliche Countdown-Beschreibung. */
export function describeCountdown(days: number): string {
  if (days < 0) return `vor ${Math.abs(days)} Tagen`;
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  if (days < 21) return `in ${days} Tagen`;
  const weeks = Math.round(days / 7);
  return `in ${weeks} Wochen`;
}

export type TrainingPhase = "base" | "build" | "specific" | "taper" | "race" | "off";

/** Grobe Periodisierungsphase abhängig von den Tagen bis zum Rennen. */
export function trainingPhase(days: number): {
  phase: TrainingPhase;
  label: string;
} {
  if (days < 0) return { phase: "off", label: "Nachbereitung" };
  if (days === 0) return { phase: "race", label: "Wettkampftag" };
  if (days <= 10) return { phase: "taper", label: "Taper" };
  if (days <= 28) return { phase: "specific", label: "Wettkampfspezifisch" };
  if (days <= 84) return { phase: "build", label: "Aufbau" };
  return { phase: "base", label: "Grundlage" };
}

export interface RacePosition {
  /** Anteil 0..1 auf der Saison-Achse (heute .. Horizont). */
  fraction: number;
  withinHorizon: boolean;
}

/** Position eines Rennens auf einer Zeitachse von heute bis `horizonDays`. */
export function racePosition(
  days: number,
  horizonDays: number,
): RacePosition {
  if (days < 0 || days > horizonDays) {
    return { fraction: days < 0 ? 0 : 1, withinHorizon: false };
  }
  return { fraction: days / horizonDays, withinHorizon: true };
}
