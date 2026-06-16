import type { PrismaClient } from "@prisma/client";
import { formatIsoDate, addDays } from "@/domain/training/dates";
import type { CoachSummaryContext } from "./buildCoachSummary";

/**
 * Sammelt die Modul-Inhalte für eine `coach_summary` aus der Datenbank.
 * Liefert zusätzlich die athleteId. Rein lesend.
 */
export async function gatherCoachSummaryContext(
  db: PrismaClient,
  opts: {
    userId: string;
    lookbackDays?: number;
    lookaheadDays?: number;
    now?: Date;
  },
): Promise<{ context: CoachSummaryContext; athleteId: string | null }> {
  const userId = opts.userId;
  const now = opts.now ?? new Date();
  const lookbackDays = opts.lookbackDays ?? 14;
  const lookaheadDays = opts.lookaheadDays ?? 14;
  const since = addDays(now, -lookbackDays);
  const until = addDays(now, lookaheadDays);

  const [
    athlete,
    recentActivities,
    plannedWorkouts,
    readiness,
    pain,
    syncCounts,
    pendingJobs,
    failedJobs,
  ] = await Promise.all([
    db.athleteProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.actualActivity.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: "desc" },
      take: 30,
    }),
    db.plannedWorkout.findMany({
      where: {
        userId,
        date: { gte: addDays(now, -1), lte: until },
        status: { in: ["planned", "synced"] },
      },
      orderBy: { date: "asc" },
    }),
    db.readinessSnapshot.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    db.painSnapshot.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    db.intervalsWorkoutSync.groupBy({
      by: ["syncStatus"],
      where: { userId },
      _count: { _all: true },
    }),
    db.syncQueue.count({ where: { userId, status: "pending" } }),
    db.syncQueue.count({ where: { userId, status: "failed" } }),
  ]);

  const [goals, latestBody, recentJournal] = await Promise.all([
    db.trainingGoal.findMany({ where: { userId }, orderBy: { sport: "asc" } }),
    db.bodyMetric.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    db.journalEntry.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 5 }),
  ]);

  // Trainingszusammenfassung der letzten Tage je Sportart.
  const summaryBySport: Record<
    string,
    { sessions: number; durationMin: number; distanceKm: number; load: number }
  > = {};
  for (const a of recentActivities) {
    const s = (summaryBySport[a.sport] ??= {
      sessions: 0,
      durationMin: 0,
      distanceKm: 0,
      load: 0,
    });
    s.sessions += 1;
    s.durationMin += a.durationMin ?? 0;
    s.distanceKm += a.distanceKm ?? 0;
    s.load += a.load ?? 0;
  }

  const context: CoachSummaryContext = {
    athleteProfile: athlete
      ? {
          name: athlete.name,
          heightCm: athlete.heightCm,
          weightKg: athlete.weightKg,
          trainingLevel: athlete.trainingLevel,
          primarySports: athlete.primarySports ?? null,
          knownLimiters: athlete.knownLimiters ?? null,
          equipment: athlete.equipment ?? null,
        }
      : null,
    seasonContext: null,
    planningConstraints: {
      weeklyGoalsMin: Object.fromEntries(
        goals.map((g) => [g.sport, g.weeklyTargetMin]),
      ),
    },
    recentTrainingSummary: {
      windowDays: lookbackDays,
      bySport: summaryBySport,
      totalSessions: recentActivities.length,
    },
    recentActivities: recentActivities.map((a) => ({
      date: formatIsoDate(a.date),
      sport: a.sport,
      durationMin: a.durationMin,
      distanceKm: a.distanceKm,
      load: a.load,
      rpe: a.rpe,
      avgHr: a.avgHr,
      source: a.source,
    })),
    currentPlannedWorkouts: plannedWorkouts.map((w) => ({
      date: formatIsoDate(w.date),
      sport: w.sport,
      title: w.title,
      plannedDurationMin: w.plannedDurationMin,
      plannedDistanceM: w.plannedDistanceM,
      rpe: w.rpe,
      status: w.status,
    })),
    readiness: readiness
      ? {
          date: formatIsoDate(readiness.date),
          status: readiness.status,
          sleepTrend: readiness.sleepTrend,
          hrvTrend: readiness.hrvTrend,
          restingHrTrend: readiness.restingHrTrend,
          subjectiveFatigue: readiness.subjectiveFatigue,
          notes: readiness.notes,
        }
      : null,
    painStatus: pain
      ? {
          date: formatIsoDate(pain.date),
          overall: pain.overall,
          knee: pain.knee,
          achilles: pain.achilles,
          calf: pain.calf,
          back: pain.back,
          notes: pain.notes,
        }
      : null,
    syncState: {
      bySyncStatus: Object.fromEntries(
        syncCounts.map((c) => [c.syncStatus, c._count._all]),
      ),
      pendingQueue: pendingJobs,
      failedQueue: failedJobs,
    },
    coachNotes: {
      body: latestBody
        ? { weightKg: latestBody.weightKg, restingHr: latestBody.restingHr }
        : null,
      recentJournal: recentJournal.map((j) => ({
        date: formatIsoDate(j.date),
        mood: j.mood,
        text: j.text,
      })),
    },
  };

  return { context, athleteId: athlete?.id ?? null };
}

function safeJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
