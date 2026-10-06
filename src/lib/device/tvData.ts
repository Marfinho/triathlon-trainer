import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { addDays, formatIsoDate } from "@/domain/training/dates";
import { segmentSchema, type Segment } from "@/domain/schemas";
import { isGuidedWorkout } from "@/domain/exercises/guided";
import { resolveExercisesForWorkout } from "@/domain/exercises/resolve";
import { formatExerciseDose } from "@/domain/exercises/duration";

/**
 * Daten für die Fire-TV-App (brick-tv): geplante Rad- und Kraft-Einheiten in
 * einem flachen, stabilen JSON-Format (siehe docs/TV_API.md).
 */

export const TV_BIKE_SPORTS = ["bike", "brick"] as const;

export interface TvBikeSegment {
  type: string;
  durationSec: number | null;
  intensity: string | null;
  targetType: string | null;
  targetValue: number | null;
  targetValueTo: number | null;
  rpeTarget: number | null;
  cadenceNote: string | null;
  description: string | null;
}

export type TvStrengthStep =
  | {
      kind: "exercise";
      exerciseId: string;
      title: string;
      dose: string;
      sets: number;
      reps: number | null;
      holdSec: number | null;
      restSec: number;
      perSide: boolean;
      loadKg: number | null;
      note: string | null;
      description: string | null;
    }
  | { kind: "text"; title: string; description: string | null; durationSec: number | null };

export interface TvWorkout {
  id: string;
  date: string;
  sport: string;
  kind: "bike" | "strength";
  title: string;
  plannedDurationMin: number;
  description: string | null;
  segments: TvBikeSegment[];
  steps: TvStrengthStep[];
}

const TEXT_STEP_TITLE: Record<string, string> = {
  warmup: "Aufwärmen",
  cooldown: "Ausklang",
  rest: "Pause",
  drill: "Technik",
};

function parseSegments(raw: unknown): Segment[] {
  const list = Array.isArray(raw) ? raw : [];
  // Gespeicherte Segmente defensiv erneut parsen (kaputte werden übersprungen).
  return list.flatMap((s) => {
    const r = segmentSchema.safeParse(s);
    return r.success ? [r.data] : [];
  });
}

export function toBikeSegments(segments: Segment[]): TvBikeSegment[] {
  return segments.map((s) => ({
    type: s.type,
    durationSec: s.durationSec,
    intensity: s.intensity,
    targetType: s.targetType,
    targetValue: s.targetValue,
    targetValueTo: s.targetValueTo,
    rpeTarget: s.rpeTarget,
    cadenceNote: s.cadenceNote,
    description: s.description,
  }));
}

export async function listTvWorkouts(
  userId: string,
  opts: { from?: Date; to?: Date } = {},
  db: PrismaClient = defaultPrisma,
): Promise<TvWorkout[]> {
  const now = new Date();
  const from = opts.from ?? addDays(now, -1);
  const to = opts.to ?? addDays(now, 14);
  const rows = await db.plannedWorkout.findMany({
    where: {
      userId,
      sport: { not: "rest" },
      status: { in: ["planned", "synced"] },
      date: { gte: from, lte: to },
    },
    orderBy: { date: "asc" },
    take: 200,
  });

  const out: TvWorkout[] = [];
  for (const w of rows) {
    const isBike = (TV_BIKE_SPORTS as readonly string[]).includes(w.sport);
    const isStrength = !isBike && isGuidedWorkout(w.sport, w.segmentsJson);
    if (!isBike && !isStrength) continue;
    const segments = parseSegments(w.segmentsJson);
    const base = {
      id: w.id,
      date: formatIsoDate(w.date),
      sport: w.sport,
      title: w.title,
      plannedDurationMin: w.plannedDurationMin,
      description: w.description,
    };
    if (isBike) {
      out.push({ ...base, kind: "bike", segments: toBikeSegments(segments), steps: [] });
      continue;
    }
    const resolved = await resolveExercisesForWorkout(userId, segments, db);
    const steps: TvStrengthStep[] = segments.map((seg) => {
      if (seg.exercise) {
        const r = resolved.get(seg.exercise.id);
        const e = seg.exercise;
        return {
          kind: "exercise",
          exerciseId: e.id,
          title: r?.status === "ok" ? r.definition.title : e.id,
          dose: formatExerciseDose(e),
          sets: e.sets,
          reps: e.reps,
          holdSec: e.reps == null ? e.holdSec : null,
          restSec: e.restSec ?? 0,
          perSide: e.perSide,
          loadKg: e.loadKg,
          note: e.note,
          description: seg.description,
        };
      }
      return {
        kind: "text",
        title: TEXT_STEP_TITLE[seg.type] ?? "Hinweis",
        description: seg.description,
        durationSec: seg.durationSec,
      };
    });
    out.push({ ...base, kind: "strength", segments: [], steps });
  }
  return out.slice(0, 60);
}

export async function tvProfile(
  userId: string,
  db: PrismaClient = defaultPrisma,
): Promise<{ name: string | null; ftpWatts: number | null; thresholdHr: number | null }> {
  const [user, athlete] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    db.athleteProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    name: athlete?.name ?? user?.name ?? null,
    ftpWatts: athlete?.ftpWatts ?? null,
    thresholdHr: athlete?.thresholdHr ?? null,
  };
}
