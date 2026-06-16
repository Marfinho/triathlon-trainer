import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mondayOfIso, formatIsoDate, addDays } from "@/domain/training/dates";
import { buildLoadSeries } from "@/domain/training/trainingLoad";
import { buildGoalProgress } from "@/domain/training/goals";
import { buildWeeklyReport } from "@/domain/training/report";

/** GET /api/report – Wochenbericht der laufenden Woche als Markdown (Download). */
export async function GET() {
  const now = new Date();
  const weekStart = mondayOfIso(now);
  const weekStartDate = new Date(`${weekStart}T00:00:00Z`);

  const [weekActivities, loadActivities, plannedThisWeek, goals] =
    await Promise.all([
      prisma.actualActivity.findMany({ where: { date: { gte: weekStartDate } } }),
      prisma.actualActivity.findMany({
        where: { date: { gte: addDays(now, -90) } },
        select: { date: true, sport: true, durationMin: true, load: true, rpe: true },
      }),
      prisma.plannedWorkout.findMany({
        where: {
          date: { gte: weekStartDate, lt: addDays(weekStartDate, 7) },
          status: { in: ["planned", "synced", "completed", "skipped"] },
        },
      }),
      prisma.trainingGoal.findMany({ orderBy: { sport: "asc" } }),
    ]);

  const bySportMap = new Map<
    string,
    { sport: string; min: number; km: number; sessions: number }
  >();
  for (const a of weekActivities) {
    const s =
      bySportMap.get(a.sport) ??
      bySportMap.set(a.sport, { sport: a.sport, min: 0, km: 0, sessions: 0 }).get(a.sport)!;
    s.min += a.durationMin ?? 0;
    s.km += a.distanceKm ?? 0;
    s.sessions += 1;
  }

  const plannedCount = plannedThisWeek.length;
  const completedCount = plannedThisWeek.filter((w) => w.status === "completed").length;
  const compliancePct = plannedCount
    ? Math.round((completedCount / plannedCount) * 100)
    : null;

  const loadSeries = buildLoadSeries(
    loadActivities.map((a) => ({
      date: a.date,
      sport: a.sport,
      durationMin: a.durationMin,
      load: a.load,
      rpe: a.rpe,
    })),
    { days: 90, today: now },
  );

  const goalProgress = buildGoalProgress(
    goals.map((g) => ({ sport: g.sport, weeklyTargetMin: g.weeklyTargetMin })),
    weekActivities.map((a) => ({ date: a.date, sport: a.sport, durationMin: a.durationMin })),
    now,
  );

  const markdown = buildWeeklyReport({
    weekStart,
    form: loadSeries.current,
    bySport: [...bySportMap.values()].sort((a, b) => b.min - a.min),
    compliancePct,
    goals: goalProgress.map((g) => ({
      sport: g.sport,
      actualMin: g.actualMin,
      targetMin: g.targetMin,
    })),
  });

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="localhub-wochenbericht-${formatIsoDate(now)}.md"`,
    },
  });
}
