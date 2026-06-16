import { prisma } from "@/lib/db";
import { addDays, formatIsoDate, mondayOfIso } from "@/domain/training/dates";
import {
  buildPlanVsActual,
  summarizeWeeklyCompliance,
} from "@/domain/training/planVsActual";
import {
  buildLoadSeries,
  buildWeeklyVolume,
  interpretForm,
  interpretAcwr,
} from "@/domain/training/trainingLoad";
import { CurrentPlan } from "@/components/dashboard/CurrentPlan";
import { PlanVsActual } from "@/components/dashboard/PlanVsActual";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { ReadinessPain } from "@/components/dashboard/ReadinessPain";
import { IntervalsSyncStatus } from "@/components/dashboard/IntervalsSyncStatus";
import { ChatGptExchange } from "@/components/dashboard/ChatGptExchange";
import { FormFitness } from "@/components/dashboard/FormFitness";
import { TrainingZones } from "@/components/dashboard/TrainingZones";
import { TrainingCalendar } from "@/components/dashboard/TrainingCalendar";
import { buildCalendar } from "@/domain/training/calendar";
import { SeasonStatsCard } from "@/components/dashboard/SeasonStats";
import { buildSeasonStats } from "@/domain/training/stats";
import { WeeklyGoals } from "@/components/dashboard/WeeklyGoals";
import { buildGoalProgress } from "@/domain/training/goals";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { BodyMetrics } from "@/components/dashboard/BodyMetrics";
import { summarizeBody } from "@/domain/training/body";
import { RacePlanner, type Race } from "@/components/dashboard/RacePlanner";
import {
  TrainerControl,
  type TrainerWorkout,
} from "@/components/dashboard/TrainerControl";
import { GearTracker, type Gear } from "@/components/dashboard/GearTracker";
import { buildGearTree } from "@/domain/training/gear";
import type { TimelineSegmentInput } from "@/integrations/trainer/workoutPlayer";

export const dynamic = "force-dynamic";

const SPORT_ORDER = ["swim", "bike", "run", "strength", "brick", "other"];

export default async function DashboardPage() {
  const now = new Date();
  const windowStart = addDays(now, -14);
  const windowEnd = addDays(now, 21);
  const loadWindowStart = addDays(now, -120);

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
    loadActivities,
    races,
    gearItems,
    gearActivities,
    syncLogs,
    goals,
    bodyMetrics,
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
    prisma.actualActivity.findMany({ orderBy: { date: "desc" }, take: 8 }),
    prisma.readinessSnapshot.findMany({ orderBy: { date: "desc" }, take: 21 }),
    prisma.painSnapshot.findMany({ orderBy: { date: "desc" }, take: 21 }),
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
    prisma.actualActivity.findMany({
      where: { date: { gte: loadWindowStart } },
      orderBy: { date: "asc" },
      select: { date: true, sport: true, durationMin: true, distanceKm: true, load: true, rpe: true },
    }),
    prisma.raceEvent.findMany({ orderBy: { date: "asc" } }),
    prisma.gearItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.actualActivity.findMany({
      select: { date: true, sport: true, distanceKm: true, durationMin: true },
    }),
    prisma.syncLog.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.trainingGoal.findMany({ orderBy: { sport: "asc" } }),
    prisma.bodyMetric.findMany({ orderBy: { date: "desc" }, take: 30 }),
  ]);

  const bodySummary = summarizeBody(
    bodyMetrics.map((b) => ({
      date: b.date,
      weightKg: b.weightKg,
      restingHr: b.restingHr,
    })),
  );

  // --- Plan vs. Ist ---
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

  // --- Form & Belastung ---
  const loadInput = loadActivities.map((a) => ({
    date: a.date,
    sport: a.sport,
    durationMin: a.durationMin,
    load: a.load,
    rpe: a.rpe,
  }));
  const loadSeries = buildLoadSeries(loadInput, { days: 90, today: now });
  const weeklyVolume = buildWeeklyVolume(loadInput, { weeks: 12, today: now });
  const seasonStats = buildSeasonStats(
    loadActivities.map((a) => ({
      date: a.date,
      sport: a.sport,
      durationMin: a.durationMin,
      distanceKm: a.distanceKm,
      load: a.load,
    })),
    { today: now },
  );
  const form = interpretForm(loadSeries.current.tsb);
  const acwrInfo = interpretAcwr(loadSeries.current.acwr);
  const presentSports = new Set<string>();
  weeklyVolume.forEach((w) =>
    Object.keys(w.bySport).forEach((s) => presentSports.add(s)),
  );
  const sports = SPORT_ORDER.filter((s) => presentSports.has(s)).concat(
    [...presentSports].filter((s) => !SPORT_ORDER.includes(s)),
  );

  // --- Trainer ---
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

  const gearTree = buildGearTree(gearItems, gearActivities) as unknown as Gear[];

  // --- Readiness/Pain (neueste + Verlauf) ---
  const readinessLatest = readiness[0] ?? null;
  const painLatest = pain[0] ?? null;
  const fatigueTrend = [...readiness]
    .reverse()
    .map((r) => r.subjectiveFatigue ?? null);
  const painTrend = [...pain].reverse().map((p) => p.overall ?? null);

  // --- Trainingskalender (Vorwoche + 3 Wochen) ---
  const calendarGrid = buildCalendar(
    rangePlanned.map((w) => ({
      date: w.date,
      sport: w.sport,
      title: w.title,
      plannedDurationMin: w.plannedDurationMin,
      status: w.status,
    })),
    rangeActuals.map((a) => ({
      date: a.date,
      sport: a.sport,
      durationMin: a.durationMin,
    })),
    { weeks: 4, weeksBefore: 1, today: now },
  );

  // --- Wochen-Summary (laufende Woche) ---
  const weekMonday = mondayOfIso(now);
  const thisWeek = loadActivities.filter(
    (a) => formatIsoDate(a.date) >= weekMonday,
  );
  const weekSummary = {
    sessions: thisWeek.length,
    hours:
      Math.round(
        (thisWeek.reduce((s, a) => s + (a.durationMin ?? 0), 0) / 60) * 10,
      ) / 10,
    distanceKm: thisWeek.reduce((s, a) => s + (a.distanceKm ?? 0), 0),
    load: thisWeek.reduce((s, a) => s + (a.load ?? 0), 0),
  };

  const racesData: Race[] = races.map((r) => ({
    id: r.id,
    name: r.name,
    date: r.date.toISOString(),
    type: r.type,
    distance: r.distance,
    priority: r.priority,
    notes: r.notes,
  }));

  const [pending, processing, failed, success, synced] = syncCounts;
  const intervalsConfigured = Boolean(
    process.env.INTERVALS_ATHLETE_ID && process.env.INTERVALS_API_KEY,
  );

  // --- Wochenziele & Kurzfrist-Load ---
  const goalProgress = buildGoalProgress(
    goals.map((g) => ({ sport: g.sport, weeklyTargetMin: g.weeklyTargetMin })),
    loadActivities.map((a) => ({
      date: a.date,
      sport: a.sport,
      durationMin: a.durationMin,
    })),
    now,
  );
  const sumLast = (arr: number[], n: number) =>
    Math.round(arr.slice(-n).reduce((s, v) => s + v, 0));
  const load7d = sumLast(loadSeries.dailyLoad, 7);
  const load28d = sumLast(loadSeries.dailyLoad, 28);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          LocalHub
        </p>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-neutral-900">
          Trainings-Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Deine Datendrehscheibe für Triathlon: Form & Belastung im Blick,
          Wettkämpfe planen, Workouts auf die Rolle bringen und mit dem LLM
          weiterentwickeln.
        </p>
      </header>

      <DashboardTabs
        tabs={[
          {
            id: "form",
            label: "Form & Planung",
            content: (
              <>
                <FormFitness
                  series={{
                    dates: loadSeries.dates,
                    ctl: loadSeries.ctl,
                    atl: loadSeries.atl,
                    tsb: loadSeries.tsb,
                  }}
                  current={loadSeries.current}
                  form={form}
                  acwr={acwrInfo}
                  load7d={load7d}
                  load28d={load28d}
                  weeks={weeklyVolume}
                  sports={sports.length ? sports : ["bike", "run", "swim"]}
                />
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <WeeklyGoals initial={goalProgress} />
                  <RacePlanner initialRaces={racesData} />
                </div>
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
                <TrainingCalendar grid={calendarGrid} />
                <SeasonStatsCard stats={seasonStats} />
                <PlanVsActual rows={planVsActualRows} weeks={weeklyCompliance} />
              </>
            ),
          },
          {
            id: "training",
            label: "Training & Material",
            content: (
              <>
                <TrainerControl
                  workouts={trainerWorkouts}
                  defaultFtp={athlete?.ftpWatts ?? 200}
                />
                <TrainingZones
                  ftp={athlete?.ftpWatts ?? null}
                  thresholdHr={athlete?.thresholdHr ?? null}
                  thresholdPaceSecPerKm={athlete?.thresholdPaceSecPerKm ?? null}
                  thresholdSwimPer100m={athlete?.thresholdSwimPer100m ?? null}
                />
                <GearTracker initialGear={gearTree} />
              </>
            ),
          },
          {
            id: "exchange",
            label: "Austausch & Sync",
            content: (
              <>
                <ChatGptExchange />
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <IntervalsSyncStatus
                    initial={{
                      configured: intervalsConfigured,
                      queue: { pending, processing, failed, success },
                      syncedWorkouts: synced,
                      recentLogs: syncLogs.map((l) => ({
                        action: l.action,
                        success: l.success,
                        reason: l.reason,
                        at: l.createdAt.toISOString(),
                      })),
                    }}
                  />
                  <ReadinessPain
                    readiness={
                      readinessLatest
                        ? {
                            date: formatIsoDate(readinessLatest.date),
                            status: readinessLatest.status,
                            sleepTrend: readinessLatest.sleepTrend,
                            hrvTrend: readinessLatest.hrvTrend,
                            restingHrTrend: readinessLatest.restingHrTrend,
                            subjectiveFatigue: readinessLatest.subjectiveFatigue,
                            notes: readinessLatest.notes,
                          }
                        : null
                    }
                    pain={
                      painLatest
                        ? {
                            date: formatIsoDate(painLatest.date),
                            overall: painLatest.overall,
                            knee: painLatest.knee,
                            achilles: painLatest.achilles,
                            calf: painLatest.calf,
                            back: painLatest.back,
                            notes: painLatest.notes,
                          }
                        : null
                    }
                    fatigueTrend={fatigueTrend}
                    painTrend={painTrend}
                  />
                </div>
                <BodyMetrics summary={bodySummary} />
              </>
            ),
          },
        ]}
      />
    </main>
  );
}
