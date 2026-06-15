import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/activities
 * Speichert eine (z.B. auf der Radrolle aufgezeichnete) Ist-Aktivität.
 * Ist-Aktivitäten sind unantastbar – diese Route legt nur NEUE Datensätze an.
 *
 * Body: { sport, date?, durationMin, distanceKm?, load?, avgHr?, rpe?,
 *         source?, notes?, samples? }
 */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungültiger Body." },
      { status: 400 },
    );
  }

  const sport = typeof body.sport === "string" ? body.sport : "bike";
  const durationMin =
    typeof body.durationMin === "number" ? body.durationMin : null;
  if (durationMin == null || durationMin <= 0) {
    return NextResponse.json(
      { ok: false, error: "durationMin fehlt oder ist ungültig." },
      { status: 400 },
    );
  }

  const date =
    typeof body.date === "string" ? new Date(body.date) : new Date();

  const created = await prisma.actualActivity.create({
    data: {
      source: typeof body.source === "string" ? body.source : "trainer",
      date,
      sport,
      durationMin,
      distanceKm:
        typeof body.distanceKm === "number" ? body.distanceKm : null,
      distanceM:
        typeof body.distanceKm === "number"
          ? Math.round(body.distanceKm * 1000)
          : null,
      load: typeof body.load === "number" ? body.load : null,
      rpe: typeof body.rpe === "number" ? body.rpe : null,
      avgHr: typeof body.avgHr === "number" ? body.avgHr : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      rawJson:
        body.samples !== undefined ? JSON.stringify(body.samples) : null,
    },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
