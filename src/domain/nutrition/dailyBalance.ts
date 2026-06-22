/**
 * Tägliche Energiebilanz: Intake (FoodLog) vs. verbrannt (abgeschlossene
 * Aktivitäten). Rein/testbar. Bewusst KEINE BMR/TDEE-Schätzung – die Bilanz
 * bezieht sich ausschließlich auf die zusätzlich durch Training verbrannte
 * Energie, nicht auf den Grundumsatz. Das hält die Berechnung transparent
 * und vermeidet eine versteckte medizinische Einschätzung.
 */

export type BalanceStatus = "underfueled" | "ok" | "surplus" | "unknown";

export interface DailyBalanceInput {
  intakeKcal: number;
  burnedKcal: number;
  /** Vom Nutzer manuell gesetztes Tagesziel (kcal). `null` = kein Ziel gesetzt. */
  targetKcal: number | null;
}

export interface DailyBalanceResult {
  intakeKcal: number;
  burnedKcal: number;
  /** intake - burnedKcal (zusätzlich zum Training verbrannte Energie). */
  netKcal: number;
  targetKcal: number | null;
  /** netKcal - targetKcal, nur wenn ein Ziel gesetzt ist. */
  deltaToTargetKcal: number | null;
  status: BalanceStatus;
}

/**
 * Schwellen für die Statuseinordnung – bewusst dokumentiert und fest, kein
 * Blackbox-Algorithmus: ±300 kcal um das Ziel gilt als "ok", außerhalb davon
 * als unter- bzw. überversorgt. Ohne gesetztes Ziel ist der Status "unknown".
 */
const STATUS_THRESHOLD_KCAL = 300;

export function computeDailyBalance(input: DailyBalanceInput): DailyBalanceResult {
  const netKcal = Math.round(input.intakeKcal - input.burnedKcal);

  if (input.targetKcal == null) {
    return {
      intakeKcal: Math.round(input.intakeKcal),
      burnedKcal: Math.round(input.burnedKcal),
      netKcal,
      targetKcal: null,
      deltaToTargetKcal: null,
      status: "unknown",
    };
  }

  const deltaToTargetKcal = Math.round(netKcal - input.targetKcal);
  let status: BalanceStatus = "ok";
  if (deltaToTargetKcal < -STATUS_THRESHOLD_KCAL) status = "underfueled";
  else if (deltaToTargetKcal > STATUS_THRESHOLD_KCAL) status = "surplus";

  return {
    intakeKcal: Math.round(input.intakeKcal),
    burnedKcal: Math.round(input.burnedKcal),
    netKcal,
    targetKcal: input.targetKcal,
    deltaToTargetKcal,
    status,
  };
}
