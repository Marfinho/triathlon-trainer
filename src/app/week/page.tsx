import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { addDays, formatIsoDate, mondayOfIso } from "@/domain/training/dates";
import { buildCalendar } from "@/domain/training/calendar";
import {
  buildPlanVsActual,
  summarizeWeeklyCompliance,
} from "@/domain/training/planVsActual";
import { buildGoalProgress } from "@/domain/training/goals";
import type { ProfileSegmentInput } from "@/domain/training/workoutProfile";
import { TrainingCalendar } from "@/components/dashboard/TrainingCalendar";
import { CurrentPlan } from "@/components/dashboard/CurrentPlan";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { WeeklyGoals } from "@/components/dashboard/WeeklyGoals";
import { PlanVsActual } from "@/components/dashboard/PlanVsActual";

export const dynamic = "force-dynamic";

export default async function WeekPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  const userId = session.user.id;

  const now = new Date();
  const windowStart = addDays(now, -14);
  const windowEnd = addDays(now, 21);

  const [upcoming, rangePlanned, rangeActuals, recentActuals, athlete, goals] =
    await Promise.all([
      prisma.plannedWorkout.findMany({
        where: {
          userId,
          date: { gte: addDays(now, -1), lte: windowEnd },
          status: { in: ["planned", "synced"] },
        },
        orderBy: { date: "asc" },
        take: 12,
      }),
      prisma.plannedWorkout.findMany({
        where: { userId, date: { gte: windowStart, lte: windowEnd } },
        orderBy: { date: "asc" },
      }),
      prisma.actualActivity.findMany({
        where: { userId, date: { gte: windowStart, lte: windowEnd } },
      }),
      prisma.actualActivity.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 50,
      }),
      prisma.athleteProfile.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.trainingGoal.findMany({ where: { userId }, orderBy: { sport: "asc" } }),
    ]);

  const calendarGrid = buildCalendar(
    rangePlanned.map((w) => ({
      date: w.date,
      sport: w.sport,
      title: w.title,
      plannedDurationMin: w.plannedDurationMin,
      status: w.status,
      plannedDistanceM: w.plannedDistanceM,
      rpe: w.rpe,
      description: w.description,
      segments: Array.isArray(w.segmentsJson)
        ? (w.segmentsJson as unknown as ProfileSegmentInput[])
        : null,
    })),
    rangeActuals.map((a) => ({
      date: a.date,
      sport: a.sport,
      durationMin: a.durationMin,
      distanceKm: a.distanceKm,
      load: a.load,
      rpe: a.rpe,
      avgHr: a.avgHr,
      avgPower: a.avgPower,
      source: a.source,
      notes: a.notes,
    })),
    { weeks: 4, weeksBefore: 1, today: now },
  );

  const planVsActualRows = buildPlanVsActual(
    rangePlanned.map((w) => ({
      id: w.id,
      date: w.date,
      sport: w.sport,
      title: w.title,
      plannedDurationMin: w.plannedDurationMin,
      status: w.status,
    })),
    rangeActuals.map((a) => ({
      id: a.id,
      date: a.date,
      sport: a.sport,
      durationMin: a.durationMin,
      distanceKm: a.distanceKm,
    })),
    now,
  );
  const weeklyCompliance = summarizeWeeklyCompliance(planVsActualRows);

  const goalProgress = buildGoalProgress(
    goals.map((g) => ({ sport: g.sport, weeklyTargetMin: g.weeklyTargetMin })),
    rangeActuals.map((a) => ({
      date: a.date,
      sport: a.sport,
      durationMin: a.durationMin,
    })),
    now,
  );

  const weekMonday = mondayOfIso(now);
  const thisWeek = recentActuals.filter((a) => formatIsoDate(a.date) >= weekMonday);
  const weekSummary = {
    sessions: thisWeek.length,
    hours:
      Math.round((thisWeek.reduce((s, a) => s + (a.durationMin ?? 0), 0) / 60) * 10) /
      10,
    distanceKm: thisWeek.reduce((s, a) => s + (a.distanceKm ?? 0), 0),
    load: thisWeek.reduce((s, a) => s + (a.load ?? 0), 0),
  };

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          LocalHub
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
          Woche
        </h1>
      </header>
      <div className="space-y-5">
        <TrainingCalendar
          grid={calendarGrid}
          ftp={athlete?.ftpWatts ?? 200}
          weightKg={athlete?.weightKg ?? null}
        />
        <WeeklyGoals initial={goalProgress} />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <CurrentPlan
            items={upcoming.map((w) => ({
              id: w.id,
              date: formatIsoDate(w.date),
              sport: w.sport,
              title: w.title,
              plannedDurationMin: w.plannedDurationMin,
              status: w.status,
            }))}
          />
          <RecentActivities
            items={recentActuals.map((a) => ({
              id: a.id,
              date: formatIsoDate(a.date),
              sport: a.sport,
              durationMin: a.durationMin,
              distanceKm: a.distanceKm,
              load: a.load,
              source: a.source,
            }))}
            summary={weekSummary}
          />
        </div>
        <PlanVsActual rows={planVsActualRows} weeks={weeklyCompliance} />
      </div>
    </main>
  );
}
