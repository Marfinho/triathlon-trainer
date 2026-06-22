import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Ernährungs-/Gesundheitsdaten erfordern eine explizite Einwilligung (DSGVO
 * Art. 9) bevor irgendeine /api/nutrition/*-Route Daten liest oder schreibt.
 * Ohne `nutritionConsentAt` wird grundsätzlich 403 zurückgegeben – nichts
 * läuft automatisch oder im Hintergrund an.
 */
export async function requireNutritionConsent(
  userId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nutritionConsentAt: true },
  });
  if (!user?.nutritionConsentAt) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "NUTRITION_CONSENT_REQUIRED",
          message: "Einwilligung zur Verarbeitung von Ernährungsdaten erforderlich.",
        },
        { status: 403 },
      ),
    };
  }
  return { ok: true };
}
