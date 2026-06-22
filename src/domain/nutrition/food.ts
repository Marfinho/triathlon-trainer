/**
 * Makro-/kcal-Berechnung aus Produkt-Stammdaten + verzehrter Menge
 * (rein/testbar, keine DB/HTTP-Zugriffe).
 */

export interface FoodProductMacros {
  kcalPer100g: number;
  proteinGPer100g?: number | null;
  carbsGPer100g?: number | null;
  fatGPer100g?: number | null;
}

export interface FoodTotals {
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

/** Skaliert Pro-100g-Werte auf eine konkrete Menge (Gramm). */
export function computeFoodTotals(
  product: FoodProductMacros,
  quantityG: number,
): FoodTotals {
  const factor = quantityG / 100;
  const scale = (per100g: number | null | undefined): number | null =>
    per100g != null ? Math.round(per100g * factor * 10) / 10 : null;

  return {
    kcal: Math.round(product.kcalPer100g * factor),
    proteinG: scale(product.proteinGPer100g),
    carbsG: scale(product.carbsGPer100g),
    fatG: scale(product.fatGPer100g),
  };
}

export interface FoodLogEntry {
  kcal: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
}

export interface DailyIntake {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  entryCount: number;
}

/** Summiert eine Liste geloggter Einträge (z.B. alle Logs eines Tages). */
export function summarizeIntake(entries: FoodLogEntry[]): DailyIntake {
  return entries.reduce<DailyIntake>(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      proteinG: acc.proteinG + (e.proteinG ?? 0),
      carbsG: acc.carbsG + (e.carbsG ?? 0),
      fatG: acc.fatG + (e.fatG ?? 0),
      entryCount: acc.entryCount + 1,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, entryCount: 0 },
  );
}
