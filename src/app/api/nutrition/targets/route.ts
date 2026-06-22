import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { requireNutritionConsent } from "@/lib/nutrition-consent";

/**
 * GET /api/nutrition/targets – eigenes Tagesziel (oder null, falls noch
 * keines gesetzt).
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  const consent = await requireNutritionConsent(user.userId);
  if (!consent.ok) return consent.response;

  const target = await prisma.dailyNutritionTarget.findUnique({ where: { userId: user.userId } });
  return NextResponse.json({ ok: true, target });
}

/**
 * PUT /api/nutrition/targets – Tagesziel setzen/aktualisieren (manuell vom
 * Nutzer, kein automatisch berechneter BMR/TDEE-Wert).
 * Body: { targetKcal?, targetProteinG?, targetCarbsG?, targetFatG? }
 */
export async function PUT(request: Request) {
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

  const toIntOrNull = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;

  const data = {
    targetKcal: toIntOrNull(body.targetKcal),
    targetProteinG: toIntOrNull(body.targetProteinG),
    targetCarbsG: toIntOrNull(body.targetCarbsG),
    targetFatG: toIntOrNull(body.targetFatG),
  };

  const target = await prisma.dailyNutritionTarget.upsert({
    where: { userId: user.userId },
    create: { userId: user.userId, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true, target });
}
