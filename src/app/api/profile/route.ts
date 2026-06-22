import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { sanitizeText } from "@/domain/security/sanitize";

/**
 * PATCH /api/profile – Athleten-Profil aktualisieren (Schwellenwerte +
 * Stammdaten). Body: beliebige Teilmenge der unterstützten Felder.
 */
export async function PATCH(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const intOrNull = (v: unknown): number | null | undefined => {
    if (v === null) return null;
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
    return undefined;
  };
  const floatOrNull = (v: unknown): number | null | undefined => {
    if (v === null) return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return undefined;
  };
  const stringOrNull = (v: unknown): string | null | undefined => {
    if (v === null) return null;
    if (typeof v === "string") return sanitizeText(v, 120);
    return undefined;
  };
  const stringArray = (v: unknown): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    return v
      .filter((x): x is string => typeof x === "string")
      .map((x) => sanitizeText(x, 120))
      .filter((x) => x.length > 0)
      .slice(0, 50);
  };

  const data: Record<string, unknown> = {};

  for (const key of ["ftpWatts", "thresholdHr", "thresholdPaceSecPerKm", "thresholdSwimPer100m"]) {
    const val = intOrNull(body[key]);
    if (val !== undefined) data[key] = val;
  }
  {
    const val = floatOrNull(body.weightKg);
    if (val !== undefined) data.weightKg = val;
  }
  {
    const val = intOrNull(body.heightCm);
    if (val !== undefined) data.heightCm = val;
  }
  {
    const val = stringOrNull(body.name);
    if (val !== undefined && val !== null && val !== "") data.name = val;
  }
  {
    const val = stringOrNull(body.trainingLevel);
    if (val !== undefined) data.trainingLevel = val;
  }
  for (const key of ["primarySports", "knownLimiters", "equipment"]) {
    if (key in body) {
      const val = stringArray(body[key]);
      if (val !== undefined) data[key] = val as object;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "Keine gültigen Felder." }, { status: 400 });
  }

  const existing = await prisma.athleteProfile.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Kein Profil vorhanden." }, { status: 404 });
  }

  const updated = await prisma.athleteProfile.update({
    where: { id: existing.id },
    data,
  });
  return NextResponse.json({
    ok: true,
    profile: {
      name: updated.name,
      heightCm: updated.heightCm,
      weightKg: updated.weightKg,
      ftpWatts: updated.ftpWatts,
      thresholdHr: updated.thresholdHr,
      thresholdPaceSecPerKm: updated.thresholdPaceSecPerKm,
      thresholdSwimPer100m: updated.thresholdSwimPer100m,
      trainingLevel: updated.trainingLevel,
      primarySports: updated.primarySports,
      knownLimiters: updated.knownLimiters,
      equipment: updated.equipment,
    },
  });
}
