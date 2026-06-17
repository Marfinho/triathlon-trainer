import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getEffectiveLimits } from "@/lib/plan-config";
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
import { summarizeBody, trendLabel } from "@/domain/training/body";
import { TrainingJournal } from "@/components/dashboard/TrainingJournal";
import { DataExport } from "@/components/dashboard/DataExport";
import { BackupRestore } from "@/components/dashboard/BackupRestore";
import { TrainingCalculators } from "@/components/dashboard/TrainingCalculators";
import { RacePlanner, type Race } from "@/components/dashboard/RacePlanner";
import { RacePredictions } from "@/components/dashboard/RacePredictions";
import {
  resolveRunReference,
  calibrateRiegelExponent,
  bestBikeReference,
} from "@/domain/training/prediction";
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
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  const userId = session.user.id;
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, role: true },
  });
  const plan = dbUser?.plan ?? "free";
  const isAdmin = dbUser?.role === "admin";
  const limits = await getEffectiveLimits(plan);

  const now = new Date();
  const windowStart = addDays(now, -14);
  const windowEnd = addDays(now, 21);
  // QUERY-GATE: Datenfenster je Plan (free 90 Tage, paid unbegrenzt).
  const historyDays = Number.isFinite(limits.activityHistoryDays)
    ? limits.activityHistoryDays
    : 3650;
  const pmcDays = Number.isFinite(limits.pmcHorizonDays)
    ? limits.pmcHorizonDays
    : 365;
  const loadWindowStart = addDays(now, -historyDays);

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
    journalEntries,
  ] = await Promise.all([
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
      take: 8,
    }),
    prisma.readinessSnapshot.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 21,
    }),
    prisma.painSnapshot.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 21,
    }),
    Promise.all([
      prisma.syncQueue.count({ where: { userId, status: "pending" } }),
      prisma.syncQueue.count({ where: { userId, status: "processing" } }),
      prisma.syncQueue.count({ where: { userId, status: "failed" } }),
      prisma.syncQueue.count({ where: { userId, status: "success" } }),
      prisma.intervalsWorkoutSync.count({ where: { userId, syncStatus: "synced" } }),
    ]),
    prisma.plannedWorkout.findMany({
      where: {
        userId,
        sport: { in: ["bike", "brick"] },
        status: { in: ["planned", "synced"] },
        date: { gte: addDays(now, -1), lte: windowEnd },
      },
      orderBy: { date: "asc" },
      take: 10,
    }),
    prisma.athleteProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.actualActivity.findMany({
      where: { userId, date: { gte: loadWindowStart } },
      orderBy: { date: "asc" },
      select: { date: true, sport: true, durationMin: true, distanceKm: true, load: true, rpe: true, avgHr: true, avgPower: true },
    }),
    prisma.raceEvent.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.gearItem.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.actualActivity.findMany({
      where: { userId },
      select: { date: true, sport: true, distanceKm: true, durationMin: true },
    }),
    prisma.syncLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.trainingGoal.findMany({ where: { userId }, orderBy: { sport: "asc" } }),
    prisma.bodyMetric.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 30,
    }),
    prisma.journalEntry.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 12,
    }),
  ]);

  const bodySummary = summarizeBody(
    bodyMetrics.map((b) => ({
      date: b.date,
      weightKg: b.weightKg,
      restingHr: b.restingHr,
      hrv: b.hrv,
    })),
  );
  // summarizeBody liefert die Reihen bereits chronologisch (älteste zuerst).
  const computedHrvTrend = trendLabel(bodySummary.hrvs);
  const computedRestingHrTrend = trendLabel(bodySummary.restingHrs);

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
    avgHr: a.avgHr,
  }));
  const loadSeries = buildLoadSeries(loadInput, {
    days: Math.min(90, pmcDays),
    today: now,
    thresholdHr: athlete?.thresholdHr,
  });
  const weeklyVolume = buildWeeklyVolume(loadInput, {
    weeks: Math.min(12, Math.max(4, Math.ceil(pmcDays / 7))),
    today: now,
  });
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
    const segments = Array.isArray(w.segmentsJson)
      ? (w.segmentsJson as unknown as TimelineSegmentInput[])
      : [];
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
    completed: r.completed,
    resultSeconds: r.resultSeconds,
    resultPlacement: r.resultPlacement,
    resultNote: r.resultNote,
  }));

  const [pending, processing, failed, success, synced] = syncCounts;
  const intervalsConfigured = Boolean(
    process.env.INTERVALS_ATHLETE_ID && process.env.INTERVALS_API_KEY,
  );

  // --- Backup-Cooldown (Free-Tier) ---
  let backupCooldownActive = false;
  let nextBackupAt: string | null = null;
  if (limits.manualBackupCooldownHours > 0) {
    const lastBackup = await prisma.syncLog.findFirst({
      where: { userId, type: "backup" },
      orderBy: { createdAt: "desc" },
    });
    if (lastBackup) {
      const next = new Date(
        lastBackup.createdAt.getTime() +
          limits.manualBackupCooldownHours * 3600 * 1000,
      );
      if (next.getTime() > now.getTime()) {
        backupCooldownActive = true;
        nextBackupAt = next.toISOString();
      }
    }
  }

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
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            LocalHub
          </p>
          <div className="flex items-center gap-2">
            <a
              href="/profile"
              className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
            >
              Profil
            </a>
            {isAdmin && (
              <a
                href="/admin"
                className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
              >
                Admin
              </a>
            )}
          </div>
        </div>
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
                <RacePredictions
                  profile={{
                    thresholdPaceSecPerKm: athlete?.thresholdPaceSecPerKm ?? null,
                    ftpWatts: athlete?.ftpWatts ?? null,
                    cssPer100m: athlete?.thresholdSwimPer100m ?? null,
                    weightKg: athlete?.weightKg ?? null,
                    ctl: loadSeries.current.ctl,
                    runReference: resolveRunReference({
                      thresholdPaceSecPerKm: athlete?.thresholdPaceSecPerKm ?? null,
                      runs: loadActivities.map((a) => ({
                        sport: a.sport,
                        distanceKm: a.distanceKm,
                        durationMin: a.durationMin,
                      })),
                    }),
                    riegelExponent: calibrateRiegelExponent(
                      loadActivities.map((a) => ({
                        sport: a.sport,
                        distanceKm: a.distanceKm,
                        durationMin: a.durationMin,
                      })),
                    ).exponent,
                    bikeReference: bestBikeReference(
                      loadActivities.map((a) => ({
                        sport: a.sport,
                        distanceKm: a.distanceKm,
                        durationMin: a.durationMin,
                        avgPower: a.avgPower,
                      })),
                    ),
                  }}
                  races={racesData.map((r) => ({
                    id: r.id,
                    name: r.name,
                    date: r.date,
                    type: r.type,
                    distance: r.distance,
                  }))}
                />
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
                <TrainingJournal
                  initial={journalEntries.map((e) => ({
                    id: e.id,
                    date: e.date.toISOString(),
                    mood: e.mood,
                    text: e.text,
                  }))}
                />
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
                <TrainingCalculators />
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
                        action: l.action ?? "",
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
                    computedHrvTrend={computedHrvTrend}
                    computedRestingHrTrend={computedRestingHrTrend}
                  />
                </div>
                <BodyMetrics summary={bodySummary} heightCm={athlete?.heightCm ?? null} />
                <DataExport />
                <BackupRestore
                  cooldownActive={backupCooldownActive}
                  nextBackupAt={nextBackupAt}
                />
              </>
            ),
          },
        ]}
      />
    </main>
  );
}
