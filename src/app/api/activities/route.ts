import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * POST /api/activities
 * Speichert eine (z.B. auf der Radrolle aufgezeichnete) Ist-Aktivität.
 * Ist-Aktivitäten sind unantastbar – diese Route legt nur NEUE Datensätze an.
 *
 * Body: { sport, date?, durationMin, distanceKm?, load?, avgHr?, avgPower?,
 *         rpe?, source?, notes?, samples? }
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungültiger Body." },
      { status: 400 },
    );
  }

  // Nur endliche Zahlen akzeptieren (NaN/Infinity bestehen `typeof === "number"`).
  const finite = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const sport = typeof body.sport === "string" ? body.sport : "bike";
  const durationMin = finite(body.durationMin);
  if (durationMin == null || durationMin <= 0) {
    return NextResponse.json(
      { ok: false, error: "durationMin fehlt oder ist ungültig." },
      { status: 400 },
    );
  }

  // Datum validieren – ungültige Eingaben fallen auf "jetzt" zurück statt 500.
  let date = new Date();
  if (typeof body.date === "string") {
    const parsed = new Date(body.date);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  // Aufzeichnungs-Samples: nur Arrays, gedeckelt (Speicher-/DoS-Schutz).
  const MAX_SAMPLES = 50000;
  const rawJson = Array.isArray(body.samples)
    ? (body.samples.slice(0, MAX_SAMPLES) as object)
    : undefined;

  const distanceKm = finite(body.distanceKm);

  const created = await prisma.actualActivity.create({
    data: {
      userId,
      source:
        typeof body.source === "string" ? body.source.slice(0, 40) : "trainer",
      date,
      sport,
      durationMin,
      distanceKm,
      distanceM: distanceKm != null ? Math.round(distanceKm * 1000) : null,
      load: finite(body.load),
      rpe: finite(body.rpe),
      avgHr: finite(body.avgHr),
      avgPower: finite(body.avgPower),
      notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null,
      rawJson,
    },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
