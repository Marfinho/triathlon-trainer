import {
  mapOffProductToFoodInput,
  type FoodProductInput,
  type OffApiResponse,
  type OffProduct,
} from "./mapProduct";

/**
 * Open Food Facts (https://world.openfoodfacts.org) – kostenlose,
 * community-gepflegte Lebensmittel-Datenbank, kein API-Key nötig. Wird
 * AUSSCHLIESSLICH serverseitig aufgerufen (API-Routen), nie aus dem Client.
 * Es werden keine nutzerbezogenen Daten an Open Food Facts übertragen – nur
 * der EAN bzw. der Suchbegriff.
 */

const BASE_URL = "https://world.openfoodfacts.org";

/** EAN/UPC: 8–14 Ziffern. Schützt vor Pfad-/Query-Injektion in die URL. */
const EAN_PATTERN = /^\d{8,14}$/;

/** Sucht ein Produkt per Barcode (EAN/UPC). `null`, wenn nicht gefunden. */
export async function fetchProductByEan(ean: string): Promise<FoodProductInput | null> {
  if (!EAN_PATTERN.test(ean)) return null;

  const res = await fetch(`${BASE_URL}/api/v2/product/${encodeURIComponent(ean)}.json`);
  if (!res.ok) {
    throw new Error(`Open-Food-Facts-API-Fehler (${res.status})`);
  }
  const data = (await res.json()) as OffApiResponse;
  if (data.status !== 1 || !data.product) return null;

  return mapOffProductToFoodInput(ean, data.product);
}

export interface OffSearchHit extends FoodProductInput {
  /** Open Food Facts liefert hier den EAN als "code". */
  code: string;
}

/** Volltextsuche nach Produktnamen (max. 20 Treffer). */
export async function searchProductsByName(query: string): Promise<OffSearchHit[]> {
  const trimmed = query.trim().slice(0, 200);
  if (trimmed.length < 2) return [];

  const url =
    `${BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(trimmed)}` +
    `&search_simple=1&action=process&json=1&page_size=20`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Food-Facts-API-Fehler (${res.status})`);
  }
  const data = (await res.json()) as { products?: Array<Record<string, unknown>> };
  const products = data.products ?? [];

  const hits: OffSearchHit[] = [];
  for (const p of products) {
    const code = typeof p.code === "string" ? p.code : null;
    if (!code || !EAN_PATTERN.test(code)) continue;
    const mapped = mapOffProductToFoodInput(code, p as unknown as OffProduct);
    if (mapped) hits.push({ ...mapped, code });
  }
  return hits;
}
