import { prisma } from "@/lib/db";
import { addDays, formatIsoDate } from "@/domain/training/dates";
import { buildPlanVsActual } from "@/domain/training/planVsActual";
import { CurrentPlan } from "@/components/dashboard/CurrentPlan";
import { PlanVsActual } from "@/components/dashboard/PlanVsActual";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { ReadinessPain } from "@/components/dashboard/ReadinessPain";
import { IntervalsSyncStatus } from "@/components/dashboard/IntervalsSyncStatus";
import { ChatGptExchange } from "@/components/dashboard/ChatGptExchange";
import {
  TrainerControl,
  type TrainerWorkout,
} from "@/components/dashboard/TrainerControl";
import type { TimelineSegmentInput } from "@/integrations/trainer/workoutPlayer";

// Immer frische Daten – das Dashboard spiegelt den aktuellen DB-Zustand.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const windowStart = addDays(now, -14);
  const windowEnd = addDays(now, 21);

  const [
    upcoming,
    rangePlanned,
    rangeActuals,
    recentActuals,
    readiness,
    pain,
    syncCounts,
    bikeWorkouts,
    athlete,
  ] = await Promise.all([
    prisma.plannedWorkout.findMany({
      where: {
        date: { gte: addDays(now, -1), lte: windowEnd },
        status: { in: ["planned", "synced"] },
      },
      orderBy: { date: "asc" },
      take: 12,
    }),
    prisma.plannedWorkout.findMany({
      where: { date: { gte: windowStart, lte: windowEnd } },
      orderBy: { date: "asc" },
    }),
    prisma.actualActivity.findMany({
      where: { date: { gte: windowStart, lte: windowEnd } },
    }),
    prisma.actualActivity.findMany({
      orderBy: { date: "desc" },
      take: 8,
    }),
    prisma.readinessSnapshot.findFirst({ orderBy: { date: "desc" } }),
    prisma.painSnapshot.findFirst({ orderBy: { date: "desc" } }),
    Promise.all([
      prisma.syncQueue.count({ where: { status: "pending" } }),
      prisma.syncQueue.count({ where: { status: "processing" } }),
      prisma.syncQueue.count({ where: { status: "failed" } }),
      prisma.syncQueue.count({ where: { status: "success" } }),
      prisma.intervalsWorkoutSync.count({ where: { syncStatus: "synced" } }),
    ]),
    prisma.plannedWorkout.findMany({
      where: {
        sport: { in: ["bike", "brick"] },
        status: { in: ["planned", "synced"] },
        date: { gte: addDays(now, -1), lte: windowEnd },
      },
      orderBy: { date: "asc" },
      take: 10,
    }),
    prisma.athleteProfile.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);

  const trainerWorkouts: TrainerWorkout[] = bikeWorkouts.map((w) => {
    let segments: TimelineSegmentInput[] = [];
    try {
      segments = JSON.parse(w.segmentsJson) as TimelineSegmentInput[];
    } catch {
      segments = [];
    }
    return {
      id: w.id,
      date: formatIsoDate(w.date),
      title: w.title,
      plannedDurationMin: w.plannedDurationMin,
      segments,
    };
  });

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

  const [pending, processing, failed, success, synced] = syncCounts;

  const intervalsConfigured = Boolean(
    process.env.INTERVALS_ATHLETE_ID && process.env.INTERVALS_API_KEY,
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-widest text-sky-400">
          LocalHub
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Workflow: CoachSummary exportieren → extern im LLM einen{" "}
          <code>localhub_plan</code> erzeugen → importieren → nach Intervals.icu
          synchronisieren → Plan vs. Ist auswerten.
        </p>
      </header>

      <div className="space-y-5">
        <ChatGptExchange />

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
          />
        </div>

        <TrainerControl
          workouts={trainerWorkouts}
          defaultFtp={athlete?.ftpWatts ?? 200}
        />

        <PlanVsActual rows={planVsActualRows} />

        <IntervalsSyncStatus
          initial={{
            configured: intervalsConfigured,
            queue: { pending, processing, failed, success },
            syncedWorkouts: synced,
          }}
        />

        <ReadinessPain
          readiness={
            readiness
              ? {
                  date: formatIsoDate(readiness.date),
                  status: readiness.status,
                  sleepTrend: readiness.sleepTrend,
                  hrvTrend: readiness.hrvTrend,
                  restingHrTrend: readiness.restingHrTrend,
                  subjectiveFatigue: readiness.subjectiveFatigue,
                  notes: readiness.notes,
                }
              : null
          }
          pain={
            pain
              ? {
                  date: formatIsoDate(pain.date),
                  overall: pain.overall,
                  knee: pain.knee,
                  achilles: pain.achilles,
                  calf: pain.calf,
                  back: pain.back,
                  notes: pain.notes,
                }
              : null
          }
        />
      </div>
    </main>
  );
}
