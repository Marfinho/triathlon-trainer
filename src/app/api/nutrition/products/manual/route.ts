import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { requireNutritionConsent } from "@/lib/nutrition-consent";
import { sanitizeText, sanitizeOptionalText } from "@/domain/security/sanitize";

const EAN_PATTERN = /^\d{8,14}$/;

/**
 * POST /api/nutrition/products/manual – privates Produkt manuell anlegen
 * (für den anlegenden Nutzer sichtbar). Optional mit `ean`, z.B. wenn ein
 * Barcode-Scan keinen Treffer in Cache/Open-Food-Facts hatte.
 * Body: { name, brand?, ean?, kcalPer100g, proteinGPer100g?, carbsGPer100g?, fatGPer100g?, servingSizeG? }
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const consent = await requireNutritionConsent(user.userId);
  if (!consent.ok) return consent.response;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const finite = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const name = sanitizeText(body.name, 200);
  const kcalPer100g = finite(body.kcalPer100g);
  if (!name || kcalPer100g == null || kcalPer100g < 0) {
    return NextResponse.json(
      { ok: false, error: "Name und kcal/100g (≥ 0) erforderlich." },
      { status: 400 },
    );
  }

  const eanRaw = typeof body.ean === "string" ? body.ean.trim() : "";
  if (eanRaw && !EAN_PATTERN.test(eanRaw)) {
    return NextResponse.json({ ok: false, error: "Ungültiger Barcode." }, { status: 400 });
  }
  const ean = eanRaw || null;

  try {
    const product = await prisma.foodProduct.create({
      data: {
        name,
        brand: sanitizeOptionalText(body.brand, 200),
        ean,
        kcalPer100g,
        proteinGPer100g: finite(body.proteinGPer100g),
        carbsGPer100g: finite(body.carbsGPer100g),
        fatGPer100g: finite(body.fatGPer100g),
        servingSizeG: finite(body.servingSizeG),
        source: "manual",
        createdByUserId: user.userId,
      },
    });
    return NextResponse.json({ ok: true, product });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Barcode bereits vorhanden." }, { status: 409 });
    }
    throw err;
  }
}
