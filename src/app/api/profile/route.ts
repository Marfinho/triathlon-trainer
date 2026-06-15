import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/profile – Schwellenwerte des (ersten) Athleten-Profils setzen.
 * Body: { ftpWatts?, thresholdHr?, thresholdPaceSecPerKm? }
 */
export async function PATCH(request: Request) {
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

  const data: Record<string, number | null> = {};
  for (const key of ["ftpWatts", "thresholdHr", "thresholdPaceSecPerKm"]) {
    const val = intOrNull(body[key]);
    if (val !== undefined) data[key] = val;
  }

  const existing = await prisma.athleteProfile.findFirst({
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
      ftpWatts: updated.ftpWatts,
      thresholdHr: updated.thresholdHr,
      thresholdPaceSecPerKm: updated.thresholdPaceSecPerKm,
    },
  });
}
