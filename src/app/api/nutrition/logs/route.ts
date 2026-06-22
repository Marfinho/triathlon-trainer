import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { requireNutritionConsent } from "@/lib/nutrition-consent";
import { sanitizeOptionalText } from "@/domain/security/sanitize";
import { computeFoodTotals } from "@/domain/nutrition/food";

/**
 * GET /api/nutrition/logs?date=YYYY-MM-DD – Logs eines Tages (Default: heute).
 */
export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const consent = await requireNutritionConsent(user.userId);
  if (!consent.ok) return consent.response;

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const day = dateParam ? dateParam.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ ok: false, error: "Ungültiges Datum." }, { status: 400 });
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const logs = await prisma.foodLog.findMany({
    where: { userId: user.userId, date: { gte: start, lt: end } },
    include: { foodProduct: { select: { name: true, brand: true, ean: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ ok: true, logs });
}

/**
 * POST /api/nutrition/logs – Verzehrmenge eines Produkts loggen. kcal/Makros
 * werden bei Anlage aus Produkt+Menge berechnet und SNAPSHOTTED.
 * Body: { foodProductId, quantityG, date?, notes? }
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

  const foodProductId = typeof body.foodProductId === "string" ? body.foodProductId : null;
  const quantityG =
    typeof body.quantityG === "number" && Number.isFinite(body.quantityG) ? body.quantityG : null;
  if (!foodProductId || quantityG == null || quantityG <= 0) {
    return NextResponse.json(
      { ok: false, error: "foodProductId und quantityG (> 0) erforderlich." },
      { status: 400 },
    );
  }

  // Sichtbarkeit: global (kein createdByUserId) oder eigenes privates Produkt.
  const product = await prisma.foodProduct.findFirst({
    where: { id: foodProductId, OR: [{ createdByUserId: null }, { createdByUserId: user.userId }] },
  });
  if (!product) {
    return NextResponse.json({ ok: false, error: "Produkt nicht gefunden." }, { status: 404 });
  }

  let date = new Date();
  if (typeof body.date === "string" && body.date) {
    const parsed = new Date(`${body.date.slice(0, 10)}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  const totals = computeFoodTotals(product, quantityG);

  const log = await prisma.foodLog.create({
    data: {
      userId: user.userId,
      foodProductId: product.id,
      date,
      quantityG,
      kcal: totals.kcal,
      proteinG: totals.proteinG,
      carbsG: totals.carbsG,
      fatG: totals.fatG,
      notes: sanitizeOptionalText(body.notes, 2000),
    },
  });

  return NextResponse.json({ ok: true, log });
}
