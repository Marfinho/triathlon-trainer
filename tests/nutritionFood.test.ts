import { describe, it, expect } from "vitest";
import { computeFoodTotals, summarizeIntake } from "@/domain/nutrition/food";

describe("computeFoodTotals", () => {
  it("skaliert Pro-100g-Werte auf die verzehrte Menge", () => {
    const totals = computeFoodTotals(
      { kcalPer100g: 200, proteinGPer100g: 10, carbsGPer100g: 20, fatGPer100g: 5 },
      150,
    );
    expect(totals.kcal).toBe(300);
    expect(totals.proteinG).toBe(15);
    expect(totals.carbsG).toBe(30);
    expect(totals.fatG).toBe(7.5);
  });

  it("liefert null für fehlende Makros statt 0", () => {
    const totals = computeFoodTotals({ kcalPer100g: 100 }, 50);
    expect(totals.kcal).toBe(50);
    expect(totals.proteinG).toBeNull();
    expect(totals.carbsG).toBeNull();
    expect(totals.fatG).toBeNull();
  });

  it("rundet kcal auf ganze Zahlen", () => {
    const totals = computeFoodTotals({ kcalPer100g: 333 }, 33);
    expect(totals.kcal).toBe(Math.round(333 * 0.33));
  });
});

describe("summarizeIntake", () => {
  it("summiert mehrere Log-Einträge", () => {
    const result = summarizeIntake([
      { kcal: 300, proteinG: 20, carbsG: 30, fatG: 10 },
      { kcal: 200, proteinG: 10, carbsG: 25, fatG: 5 },
    ]);
    expect(result).toEqual({ kcal: 500, proteinG: 30, carbsG: 55, fatG: 15, entryCount: 2 });
  });

  it("behandelt fehlende Makros als 0, nicht als Fehler", () => {
    const result = summarizeIntake([{ kcal: 100 }, { kcal: 50, proteinG: 5 }]);
    expect(result.kcal).toBe(150);
    expect(result.proteinG).toBe(5);
    expect(result.entryCount).toBe(2);
  });

  it("liefert ein Null-Ergebnis für eine leere Liste", () => {
    const result = summarizeIntake([]);
    expect(result).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, entryCount: 0 });
  });
});
