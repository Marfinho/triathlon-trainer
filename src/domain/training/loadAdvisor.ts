import { mondayOfIso } from "./dates";
import type { FormState, RiskLevel } from "./trainingLoad";

/**
 * Belastungs-Beratung (rein/testbar): Wochen-Steigerungsrate mit Verletzungs-
 * Warnung, Konsistenz-Score und eine konkrete Trainingsempfehlung aus Form
 * (TSB) und Akut-/Chronisch-Verhältnis (ACWR).
 */

export interface RampActivity {
  date: Date | string;
  load: number | null;
}

export interface WeeklyRamp {
  weekStart: string;
  load: number;
  /** Verhältnis zur Vorwoche (null bei erster Woche / Vorwoche 0). */
  ratio: number | null;
}

export interface RampRateResult {
  weeks: WeeklyRamp[];
  latestRatio: number | null;
  /** Sportwissenschaftliche Faustregel: >1.5 Steigerung gilt als riskant. */
  risk: RiskLevel;
}

/**
 * Wöchentliche Load-Summen und die Steigerungsrate zur jeweiligen Vorwoche.
 * Eine Steigerung von mehr als 50 % (Ratio > 1.5) gilt als erhöhtes
 * Verletzungsrisiko, 30–50 % als Beobachtungsbereich.
 */
export function weeklyRampRate(activities: RampActivity[]): RampRateResult {
  const byWeek = new Map<string, number>();
  for (const a of activities) {
    const wk = mondayOfIso(a.date);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + (a.load ?? 0));
  }

  const sorted = [...byWeek.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const weeks: WeeklyRamp[] = sorted.map(([weekStart, load], i) => {
    const prev = i > 0 ? sorted[i - 1][1] : null;
    const ratio = prev && prev > 0 ? Math.round((load / prev) * 100) / 100 : null;
    return { weekStart, load: Math.round(load), ratio };
  });

  const latestRatio = weeks.length > 0 ? weeks[weeks.length - 1].ratio : null;
  let risk: RiskLevel = "ok";
  if (latestRatio != null) {
    if (latestRatio > 1.5) risk = "high";
    else if (latestRatio >= 1.3 || latestRatio < 0.6) risk = "high";
    else risk = "low";
  }

  return { weeks, latestRatio, risk };
}

// --------------------------------------------------------------------------
// Konsistenz-Score
// --------------------------------------------------------------------------

export interface ConsistencyInput {
  /** Geplante Workouts (offene + erledigte), nur Trainingstage. */
  plannedCount: number;
  /** Davon tatsächlich erledigt. */
  completedCount: number;
}

export interface ConsistencyScore {
  score: number; // 0–100
  label: string;
}

export function consistencyScore(input: ConsistencyInput): ConsistencyScore {
  if (input.plannedCount <= 0) {
    return { score: 0, label: "keine Daten" };
  }
  const score = Math.round(
    (Math.min(input.completedCount, input.plannedCount) / input.plannedCount) * 100,
  );
  let label = "ausbaufähig";
  if (score >= 90) label = "exzellent";
  else if (score >= 75) label = "stark";
  else if (score >= 60) label = "solide";
  return { score, label };
}

// --------------------------------------------------------------------------
// Trainingsempfehlung
// --------------------------------------------------------------------------

export type RecommendationLevel = "go_hard" | "steady" | "easy" | "recover";

export interface TrainingRecommendation {
  level: RecommendationLevel;
  headline: string;
  detail: string;
}

/**
 * Leitet aus Form (TSB) und ACWR eine konkrete Empfehlung ab. ACWR-Risiko hat
 * Vorrang (Verletzungsschutz), danach entscheidet die Frische.
 */
export function recommendTraining(
  tsb: number | null,
  acwr: number | null,
  formState?: FormState,
): TrainingRecommendation {
  if (acwr != null && acwr > 1.5) {
    return {
      level: "recover",
      headline: "Belastung zurückfahren",
      detail:
        "Dein Akut-/Chronisch-Verhältnis liegt im roten Bereich – hohes Verletzungsrisiko. Plane Erholung statt harter Reize.",
    };
  }

  if (tsb == null) {
    return {
      level: "steady",
      headline: "Stetig weitertrainieren",
      detail: "Noch zu wenig Daten für eine Frische-Aussage. Halte deine Routine.",
    };
  }

  if (tsb <= -25) {
    return {
      level: "recover",
      headline: "Erholung nötig",
      detail: "Deutlich ermüdet. Ein bis zwei ruhige Tage bringen dich nach vorne.",
    };
  }
  if (tsb < -10) {
    return {
      level: "easy",
      headline: "Locker halten",
      detail: "Du trägst Ermüdung. Grundlage und Technik statt Intensität.",
    };
  }
  if (tsb > 15) {
    return {
      level: "go_hard",
      headline: "Bereit für harte Reize",
      detail: `Du bist frisch${
        formState ? ` (${formState})` : ""
      } – ideal für Intervalle oder einen langen Schlüsselreiz.`,
    };
  }
  return {
    level: "steady",
    headline: "Solide Trainingszone",
    detail: "Gute Balance aus Fitness und Frische – plane nach Periodisierung.",
  };
}
