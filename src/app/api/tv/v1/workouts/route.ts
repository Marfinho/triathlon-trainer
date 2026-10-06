import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOrDevice } from "@/lib/device/auth";
import { addDays, formatIsoDate } from "@/domain/training/dates";
import { buildWorkoutTimeline, type TimelineSegmentInput } from "@/integrations/trainer/workoutPlayer";
import { computeHrZones, computePowerZones } from "@/domain/training/zones";
import { exerciseIdsFromSegments, isGuidedWorkout } from "@/domain/exercises/guided";
import { resolveExercisesForWorkout } from "@/domain/exercises/resolve";
import { formatExerciseDose } from "@/domain/exercises/duration";
import { segmentSchema } from "@/domain/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_FTP = 200;

/**
 * GET /api/tv/v1/workouts?days=21 – Einheiten für die TV-App (Session oder Geräte-Token).
 * `bike`: Rad-/Brick-Workouts mit Segmenten und vorberechneter Watt-Timeline.
 * `strength`: geführte Kraft-/Mobility-Einheiten mit aufgelösten Übungen (Text).
 */
export async function GET(request: Request) {
  const auth = await requireUserOrDevice(request);
  if (auth.response) return auth.response;
  const { userId } = auth;

  const daysParam = Number(new URL(request.url).searchParams.get("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(Math.floor(daysParam), 60) : 21;
  const now = new Date();
  const range = { gte: addDays(now, -1), lte: addDays(now, days) };

  const [athlete, bikeRows, candidates] = await Promise.all([
    prisma.athleteProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.plannedWorkout.findMany({
      where: { userId, sport: { in: ["bike", "brick"] }, status: { in: ["planned", "synced"] }, date: range },
      orderBy: { date: "asc" },
      take: 30,
    }),
    prisma.plannedWorkout.findMany({
      where: { userId, sport: { not: "rest" }, status: { in: ["planned", "synced"] }, date: range },
      orderBy: { date: "asc" },
      take: 200,
    }),
  ]);

  const ftp = athlete?.ftpWatts ?? DEFAULT_FTP;

  const bike = bikeRows.map((w) => {
    const segments = Array.isArray(w.segmentsJson)
      ? (w.segmentsJson as unknown as TimelineSegmentInput[])
      : [];
    return {
      id: w.id,
      date: formatIsoDate(w.date),
      title: w.title,
      sport: w.sport,
      plannedDurationMin: w.plannedDurationMin,
      segments,
      timeline: buildWorkoutTimeline(segments, { ftp }),
    };
  });

  const strength = await Promise.all(
    candidates
      .filter((w) => isGuidedWorkout(w.sport, w.segmentsJson))
      .slice(0, 30)
      .map(async (w) => {
        const raw = Array.isArray(w.segmentsJson) ? w.segmentsJson : [];
        const segments = raw.flatMap((s) => {
          const r = segmentSchema.safeParse(s);
          return r.success ? [r.data] : [];
        });
        const resolved = exerciseIdsFromSegments(segments).length
          ? await resolveExercisesForWorkout(userId, segments)
          : new Map();
        const steps = segments.map((seg) => {
          if (seg.exercise) {
            const r = resolved.get(seg.exercise.id);
            const e = seg.exercise;
            return {
              kind: "exercise" as const,
              exerciseId: e.id,
              title: r?.status === "ok" ? r.definition.title : e.id,
              dose: formatExerciseDose(e),
              note: e.note ?? seg.description ?? null,
              sets: e.sets,
              reps: e.reps ?? null,
              holdSec: e.reps == null ? (e.holdSec ?? null) : null,
              restSec: e.restSec ?? 0,
              perSide: e.perSide,
            };
          }
          return {
            kind: "text" as const,
            segmentType: seg.type,
            description: seg.description ?? null,
            durationSec: seg.durationSec ?? null,
          };
        });
        return {
          id: w.id,
          date: formatIsoDate(w.date),
          title: w.title,
          sport: w.sport,
          plannedDurationMin: w.plannedDurationMin,
          steps,
        };
      }),
  );

  return NextResponse.json(
    {
      device: auth.via === "device" ? { name: auth.deviceName } : null,
      athlete: {
        name: athlete?.name ?? null,
        ftpWatts: ftp,
        thresholdHr: athlete?.thresholdHr ?? null,
        powerZones: computePowerZones(ftp),
        hrZones: athlete?.thresholdHr ? computeHrZones(athlete.thresholdHr) : null,
      },
      bike,
      strength,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
