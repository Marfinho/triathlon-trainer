import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Legt eine neue Ist-Aktivität aus einem Request-Body an (gemeinsam genutzt von
 * POST /api/activities und POST /api/tv/v1/activities). Nur NEUE Datensätze.
 *
 * Body: { sport, date?, durationMin, distanceKm?, load?, avgHr?, avgPower?,
 *         rpe?, source?, notes?, samples?, externalId? }
 *
 * `externalId` (client-erzeugt, z. B. UUID) macht das Hochladen idempotent: ein
 * Wiederholen nach Netzabbruch liefert die bestehende Aktivität statt eines Duplikats.
 */
export async function createActivityFromRequest(
  userId: string,
  request: Request,
  defaultSource = "trainer",
): Promise<NextResponse> {
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

  const source = typeof body.source === "string" ? body.source.slice(0, 40) : defaultSource;
  const externalId =
    typeof body.externalId === "string" && body.externalId.trim()
      ? body.externalId.trim().slice(0, 100)
      : null;
  if (externalId) {
    const existing = await prisma.actualActivity.findFirst({
      where: { userId, source, externalId },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ ok: true, id: existing.id, duplicate: true });
  }

  let created: { id: string };
  try {
    created = await prisma.actualActivity.create({
      data: {
        userId,
        externalId,
        source,
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
  } catch (e) {
    // Paralleler Wiederholungs-Upload mit gleicher externalId: bestehende Aktivität liefern.
    if (externalId && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.actualActivity.findFirst({
        where: { userId, source, externalId },
        select: { id: true },
      });
      if (existing) return NextResponse.json({ ok: true, id: existing.id, duplicate: true });
    }
    throw e;
  }

  return NextResponse.json({ ok: true, id: created.id });
}
