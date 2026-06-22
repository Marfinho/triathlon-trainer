import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { requireNutritionConsent } from "@/lib/nutrition-consent";
import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { sanitizeOptionalText } from "@/domain/security/sanitize";

/**
 * PUT /api/nutrition/products/:id/verify – Korrektur eines Produkts
 * (z.B. fehlerhafte Open-Food-Facts-Daten). Jede Korrektur wird auditiert,
 * da sie für ALLE Nutzer sichtbar ist, die dieses Produkt loggen.
 * Body: { kcalPer100g?, proteinGPer100g?, carbsGPer100g?, fatGPer100g?, servingSizeG?, name?, brand? }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireUser();
  if (response) return response;
  const consent = await requireNutritionConsent(user.userId);
  if (!consent.ok) return consent.response;

  const { id } = await params;
  const existing = await prisma.foodProduct.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Produkt nicht gefunden." }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const finite = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const data: Record<string, unknown> = {};
  if (body.kcalPer100g !== undefined) {
    const v = finite(body.kcalPer100g);
    if (v == null || v < 0) {
      return NextResponse.json({ ok: false, error: "kcalPer100g muss ≥ 0 sein." }, { status: 400 });
    }
    data.kcalPer100g = v;
  }
  if (body.proteinGPer100g !== undefined) data.proteinGPer100g = finite(body.proteinGPer100g);
  if (body.carbsGPer100g !== undefined) data.carbsGPer100g = finite(body.carbsGPer100g);
  if (body.fatGPer100g !== undefined) data.fatGPer100g = finite(body.fatGPer100g);
  if (body.servingSizeG !== undefined) data.servingSizeG = finite(body.servingSizeG);
  if (body.name !== undefined) {
    const name = sanitizeOptionalText(body.name, 200);
    if (name) data.name = name;
  }
  if (body.brand !== undefined) data.brand = sanitizeOptionalText(body.brand, 200);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "Keine Änderungen übergeben." }, { status: 400 });
  }

  const updated = await prisma.foodProduct.update({
    where: { id },
    data: {
      ...data,
      verified: true,
      verifiedByUserId: user.userId,
      verifiedAt: new Date(),
    },
  });

  await recordAudit({
    userId: user.userId,
    action: "nutrition_product_corrected",
    ip: clientIp(request),
    meta: { productId: id, before: existing, after: data },
  });

  return NextResponse.json({ ok: true, product: updated });
}
