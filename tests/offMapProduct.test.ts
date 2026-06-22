import { describe, it, expect } from "vitest";
import { mapOffProductToFoodInput } from "@/integrations/open-food-facts/mapProduct";

describe("mapOffProductToFoodInput", () => {
  it("mappt ein vollständiges Produkt", () => {
    const result = mapOffProductToFoodInput("4000417025005", {
      product_name_de: "Vollmilchschokolade",
      product_name: "Milk Chocolate",
      brands: "Marke A, Marke B",
      serving_quantity: 25,
      nutriments: {
        "energy-kcal_100g": 534,
        proteins_100g: 7.6,
        carbohydrates_100g: 56,
        fat_100g: 31,
      },
    });
    expect(result).toEqual({
      ean: "4000417025005",
      name: "Vollmilchschokolade",
      brand: "Marke A",
      kcalPer100g: 534,
      proteinGPer100g: 7.6,
      carbsGPer100g: 56,
      fatGPer100g: 31,
      servingSizeG: 25,
    });
  });

  it("bevorzugt den deutschen Namen, fällt aber auf den Standardnamen zurück", () => {
    const result = mapOffProductToFoodInput("123", {
      product_name: "Only English",
      nutriments: { "energy-kcal_100g": 100 },
    });
    expect(result?.name).toBe("Only English");
  });

  it("liefert null ohne Namen", () => {
    const result = mapOffProductToFoodInput("123", {
      nutriments: { "energy-kcal_100g": 100 },
    });
    expect(result).toBeNull();
  });

  it("liefert null ohne kcal-Wert", () => {
    const result = mapOffProductToFoodInput("123", { product_name: "Test" });
    expect(result).toBeNull();
  });

  it("liefert null bei nicht-finiten kcal-Werten", () => {
    const result = mapOffProductToFoodInput("123", {
      product_name: "Test",
      nutriments: { "energy-kcal_100g": Number.NaN },
    });
    expect(result).toBeNull();
  });

  it("liefert null für brand/Makros, wenn nicht vorhanden", () => {
    const result = mapOffProductToFoodInput("123", {
      product_name: "Test",
      nutriments: { "energy-kcal_100g": 50 },
    });
    expect(result).toEqual({
      ean: "123",
      name: "Test",
      brand: null,
      kcalPer100g: 50,
      proteinGPer100g: null,
      carbsGPer100g: null,
      fatGPer100g: null,
      servingSizeG: null,
    });
  });
});
