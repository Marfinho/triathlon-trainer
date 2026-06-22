/**
 * Einfache, nicht-medizinische Fütterungs-Hinweise (rein/testbar). Bewusst
 * nur generische, sportwissenschaftlich grob plausible Faustregeln – keine
 * personalisierte Ernährungsberatung, keine automatische Plananpassung. Der
 * Nutzer entscheidet selbst, was er daraus macht.
 */

import type { DailyBalanceResult } from "./dailyBalance";
import type { DailyEnergyForecast } from "./forecast";

export interface FuelingHint {
  level: "info" | "notice";
  text: string;
}

/**
 * Hinweise aus der heutigen Bilanz und der erwarteten Belastung der nächsten
 * Tage. Reine Textbausteine, keine Mengen-Empfehlung pro Lebensmittel.
 */
export function buildFuelingHints(
  todayBalance: DailyBalanceResult,
  upcomingForecast: DailyEnergyForecast[],
): FuelingHint[] {
  const hints: FuelingHint[] = [];

  if (todayBalance.status === "underfueled") {
    hints.push({
      level: "notice",
      text: "Die heutige Bilanz liegt deutlich unter dem Ziel – achte auf ausreichende Zufuhr, besonders vor anstrengenden Einheiten.",
    });
  } else if (todayBalance.status === "surplus") {
    hints.push({
      level: "info",
      text: "Die heutige Bilanz liegt deutlich über dem Ziel.",
    });
  }

  const nextHighLoadDay = upcomingForecast.find((d) => d.kcal >= 600);
  if (nextHighLoadDay) {
    hints.push({
      level: "info",
      text: `Am ${nextHighLoadDay.date} steht eine energieintensive Einheit an (≈${nextHighLoadDay.kcal} kcal, Konfidenz: ${nextHighLoadDay.confidence}) – ausreichend Carbs am Vortag/-abend einplanen.`,
    });
  }

  return hints;
}
