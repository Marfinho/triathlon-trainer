import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { requireNutritionConsent } from "@/lib/nutrition-consent";
import { fetchProductByEan } from "@/integrations/open-food-facts/client";

const EAN_PATTERN = /^\d{8,14}$/;

/**
 * GET /api/nutrition/products/barcode/:ean – Produkt per EAN/Barcode finden.
 * Erst lokaler Cache (global, von allen Nutzern geteilt), sonst Open Food
 * Facts (serverseitig, einmalig); Treffer werden im Cache gespeichert.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ean: string }> },
) {
  const { user, response } = await requireUser();
  if (response) return response;
  const consent = await requireNutritionConsent(user.userId);
  if (!consent.ok) return consent.response;

  const { ean } = await params;
  if (!EAN_PATTERN.test(ean)) {
    return NextResponse.json({ ok: false, error: "Ungültiger Barcode." }, { status: 400 });
  }

  const cached = await prisma.foodProduct.findUnique({ where: { ean } });
  if (cached) {
    return NextResponse.json({ ok: true, product: cached, source: "cache" });
  }

  let fetched;
  try {
    fetched = await fetchProductByEan(ean);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Open-Food-Facts ist aktuell nicht erreichbar." },
      { status: 502 },
    );
  }
  if (!fetched) {
    return NextResponse.json({ ok: false, error: "Produkt nicht gefunden." }, { status: 404 });
  }

  const product = await prisma.foodProduct.upsert({
    where: { ean: fetched.ean },
    create: {
      ean: fetched.ean,
      name: fetched.name,
      brand: fetched.brand,
      kcalPer100g: fetched.kcalPer100g,
      proteinGPer100g: fetched.proteinGPer100g,
      carbsGPer100g: fetched.carbsGPer100g,
      fatGPer100g: fetched.fatGPer100g,
      servingSizeG: fetched.servingSizeG,
      source: "open_food_facts",
    },
    update: {},
  });

  return NextResponse.json({ ok: true, product, source: "open_food_facts" });
}
