import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * POST /api/checkin – Tages-Check-in: legt einen Readiness- und/oder
 * Pain-Snapshot an (jeweils neuer Datensatz, nichts wird überschrieben).
 *
 * Body: {
 *   date?, readiness?: { status, sleepTrend, hrvTrend, restingHrTrend, subjectiveFatigue, notes },
 *   pain?: { overall, knee, achilles, calf, back, notes }
 * }
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const date =
    typeof body.date === "string" && body.date
      ? new Date(`${body.date.slice(0, 10)}T00:00:00Z`)
      : new Date();

  const r = (body.readiness ?? null) as Record<string, unknown> | null;
  const p = (body.pain ?? null) as Record<string, unknown> | null;

  const intOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
  const strOrNull = (v: unknown): string | null =>
    typeof v === "string" && v ? v : null;

  const created: { readiness?: string; pain?: string } = {};

  if (r) {
    const snap = await prisma.readinessSnapshot.create({
      data: {
        userId,
        date,
        status: strOrNull(r.status),
        sleepTrend: strOrNull(r.sleepTrend),
        hrvTrend: strOrNull(r.hrvTrend),
        restingHrTrend: strOrNull(r.restingHrTrend),
        subjectiveFatigue: intOrNull(r.subjectiveFatigue),
        notes: strOrNull(r.notes),
      },
    });
    created.readiness = snap.id;
  }

  if (p) {
    const snap = await prisma.painSnapshot.create({
      data: {
        userId,
        date,
        overall: intOrNull(p.overall),
        knee: intOrNull(p.knee),
        achilles: intOrNull(p.achilles),
        calf: intOrNull(p.calf),
        back: intOrNull(p.back),
        notes: strOrNull(p.notes),
      },
    });
    created.pain = snap.id;
  }

  if (!created.readiness && !created.pain) {
    return NextResponse.json(
      { ok: false, error: "Keine Daten übergeben." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, created });
}
