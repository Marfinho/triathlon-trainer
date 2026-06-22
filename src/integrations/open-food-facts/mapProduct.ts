/**
 * Mapping der Open-Food-Facts-Antwortstruktur auf unser internes
 * Produkt-Eingabeformat. Rein/testbar – keine HTTP/DB-Zugriffe.
 */

export interface OffNutriments {
  "energy-kcal_100g"?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
}

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  brands?: string;
  serving_quantity?: number;
  nutriments?: OffNutriments;
}

export interface OffApiResponse {
  status?: number;
  product?: OffProduct;
}

export interface FoodProductInput {
  ean: string;
  name: string;
  brand: string | null;
  kcalPer100g: number;
  proteinGPer100g: number | null;
  carbsGPer100g: number | null;
  fatGPer100g: number | null;
  servingSizeG: number | null;
}

/**
 * Wandelt eine Open-Food-Facts-Produktantwort in unser Eingabeformat um.
 * Liefert `null`, wenn essenzielle Felder (Name, kcal) fehlen – die
 * Community-Daten sind nicht immer vollständig.
 */
export function mapOffProductToFoodInput(
  ean: string,
  product: OffProduct,
): FoodProductInput | null {
  const name = product.product_name_de || product.product_name;
  const kcal = product.nutriments?.["energy-kcal_100g"];
  if (!name || typeof kcal !== "number" || !Number.isFinite(kcal)) return null;

  return {
    ean,
    name,
    brand: product.brands ? product.brands.split(",")[0].trim() : null,
    kcalPer100g: kcal,
    proteinGPer100g:
      typeof product.nutriments?.proteins_100g === "number"
        ? product.nutriments.proteins_100g
        : null,
    carbsGPer100g:
      typeof product.nutriments?.carbohydrates_100g === "number"
        ? product.nutriments.carbohydrates_100g
        : null,
    fatGPer100g:
      typeof product.nutriments?.fat_100g === "number"
        ? product.nutriments.fat_100g
        : null,
    servingSizeG:
      typeof product.serving_quantity === "number"
        ? product.serving_quantity
        : null,
  };
}
