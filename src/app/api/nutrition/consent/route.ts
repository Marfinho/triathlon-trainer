import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * GET /api/nutrition/consent – aktuellen Einwilligungsstatus abfragen.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { nutritionConsentAt: true },
  });

  return NextResponse.json({
    ok: true,
    nutritionConsentAt: dbUser?.nutritionConsentAt ?? null,
  });
}

/**
 * POST /api/nutrition/consent – explizite Einwilligung zur Verarbeitung von
 * Ernährungs-/Gesundheitsdaten (DSGVO Art. 9) erteilen. Ohne diesen Schritt
 * bleiben alle anderen /api/nutrition/*-Routen mit 403 gesperrt.
 */
export async function POST() {
  const { user, response } = await requireUser();
  if (response) return response;

  const updated = await prisma.user.update({
    where: { id: user.userId },
    data: { nutritionConsentAt: new Date() },
    select: { nutritionConsentAt: true },
  });

  return NextResponse.json({ ok: true, nutritionConsentAt: updated.nutritionConsentAt });
}

/**
 * DELETE /api/nutrition/consent – Einwilligung widerrufen. Bestehende Daten
 * bleiben erhalten (Widerruf sperrt nur künftige Verarbeitung), Löschung
 * läuft über den bestehenden Export/Delete-Mechanismus.
 */
export async function DELETE() {
  const { user, response } = await requireUser();
  if (response) return response;

  await prisma.user.update({
    where: { id: user.userId },
    data: { nutritionConsentAt: null },
  });

  return NextResponse.json({ ok: true, nutritionConsentAt: null });
}
