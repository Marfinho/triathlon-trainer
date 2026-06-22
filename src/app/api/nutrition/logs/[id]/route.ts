import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { requireNutritionConsent } from "@/lib/nutrition-consent";

/**
 * DELETE /api/nutrition/logs/:id – eigenen Log-Eintrag löschen.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireUser();
  if (response) return response;
  const consent = await requireNutritionConsent(user.userId);
  if (!consent.ok) return consent.response;

  const { id } = await params;
  const log = await prisma.foodLog.findFirst({ where: { id, userId: user.userId } });
  if (!log) {
    return NextResponse.json({ ok: false, error: "Nicht gefunden." }, { status: 404 });
  }

  await prisma.foodLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
