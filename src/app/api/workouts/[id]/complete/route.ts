import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { sanitizeOptionalText } from "@/domain/security/sanitize";

/**
 * Geplante Einheit als erledigt markieren (bzw. zurücksetzen).
 *
 * POST /api/workouts/:id/complete
 *   Body: { mode?: "guided" | "manual", durationMin?, rpe?, notes? }
 *   - setzt PlannedWorkout.status = "completed"
 *   - legt dazu eine Ist-Aktivität an (Quelle "guided" = Kraft-Player,
 *     "manual" = von Hand markiert), damit die Einheit im Kalender als
 *     absolviert erscheint und in Load/CTL einfließt.
 *   - idempotent: ist die Einheit schon erledigt, wird nichts doppelt angelegt.
 *
 * DELETE /api/workouts/:id/complete
 *   Setzt den Status zurück und entfernt NUR die Ist-Aktivität, die durch das
 *   Markieren entstanden ist (Quelle guided/manual, externalId = Workout-ID).
 *   Importierte Aktivitäten (Strava, Intervals, …) bleiben unangetastet.
 */

const COMPLETION_SOURCES = ["guided", "manual"] as const;
type CompletionSource = (typeof COMPLETION_SOURCES)[number];

const COMPLETABLE = new Set(["planned", "synced", "skipped"]);

function finite(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function loadWorkout(userId: string, id: string) {
  return prisma.plannedWorkout.findFirst({
    where: { id, userId },
    select: {
      id: true,
      date: true,
      sport: true,
      title: true,
      status: true,
      plannedDurationMin: true,
      plannedDistanceM: true,
      rpe: true,
      intervalsSync: { select: { id: true } },
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const workout = await loadWorkout(userId, id);
  if (!workout) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  if (workout.status === "completed") {
    const existing = await prisma.actualActivity.findFirst({
      where: { userId, externalId: workout.id, source: { in: [...COMPLETION_SOURCES] } },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, already: true, activityId: existing?.id ?? null });
  }
  if (!COMPLETABLE.has(workout.status)) {
    return NextResponse.json(
      { ok: false, error: "Diese Einheit ist nicht mehr aktiv (ersetzt oder storniert)." },
      { status: 409 },
    );
  }

  const source: CompletionSource = body.mode === "guided" ? "guided" : "manual";

  const rawDuration = finite(body.durationMin);
  if (rawDuration != null && (rawDuration <= 0 || rawDuration > 24 * 60)) {
    return NextResponse.json({ ok: false, error: "durationMin ist ungültig." }, { status: 400 });
  }
  const durationMin =
    rawDuration != null ? Math.round(rawDuration * 10) / 10 : workout.plannedDurationMin;

  const rawRpe = finite(body.rpe);
  if (rawRpe != null && (rawRpe < 1 || rawRpe > 10)) {
    return NextResponse.json({ ok: false, error: "rpe muss zwischen 1 und 10 liegen." }, { status: 400 });
  }
  const rpe = rawRpe ?? workout.rpe ?? null;
  const notes = sanitizeOptionalText(body.notes, 2000);

  // Geführte Einheit: jetzt absolviert. Von Hand markiert: am geplanten Tag.
  const date = source === "guided" ? new Date() : workout.date;

  const result = await prisma.$transaction(async (tx) => {
    // Bedingtes Update schützt gegen Doppelklick/parallele Requests.
    const updated = await tx.plannedWorkout.updateMany({
      where: { id: workout.id, userId, status: { in: [...COMPLETABLE] } },
      data: { status: "completed" },
    });
    if (updated.count === 0) return null;

    if (!(durationMin > 0)) return { activityId: null as string | null };

    const activity = await tx.actualActivity.upsert({
      where: { userId_source_externalId: { userId, source, externalId: workout.id } },
      update: {},
      create: {
        userId,
        source,
        externalId: workout.id,
        date,
        sport: workout.sport,
        durationMin,
        distanceKm:
          source === "manual" && workout.plannedDistanceM ? workout.plannedDistanceM / 1000 : null,
        distanceM: source === "manual" ? workout.plannedDistanceM : null,
        rpe,
        notes: notes ?? workout.title,
      },
      select: { id: true },
    });
    return { activityId: activity.id as string | null };
  });

  if (!result) {
    return NextResponse.json({ ok: true, already: true, activityId: null });
  }
  return NextResponse.json({ ok: true, activityId: result.activityId });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;
  const { id } = await params;

  const workout = await loadWorkout(userId, id);
  if (!workout) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (workout.status !== "completed") {
    return NextResponse.json({ ok: true, already: true });
  }

  await prisma.$transaction([
    prisma.actualActivity.deleteMany({
      where: { userId, externalId: workout.id, source: { in: [...COMPLETION_SOURCES] } },
    }),
    prisma.plannedWorkout.update({
      where: { id: workout.id },
      data: { status: workout.intervalsSync ? "synced" : "planned" },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
