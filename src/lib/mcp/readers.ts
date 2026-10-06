import type { PrismaClient } from "@prisma/client";
import { formatIsoDate, addDays, mondayOfIso, parseIsoDate } from "@/domain/training/dates";
import {
  buildLoadSeries,
  buildWeeklyVolume,
  estimateActivityLoad,
  interpretAcwr,
  interpretForm,
} from "@/domain/training/trainingLoad";
import { buildPlanVsActual, summarizeWeeklyCompliance } from "@/domain/training/planVsActual";
import { forecastForm } from "@/domain/training/formForecast";
import { daysUntilRace, trainingPhase } from "@/domain/training/races";
import { buildPerformanceModel, perfActivityFromRow } from "@/domain/training/performanceModel";
import { intensityDistribution } from "@/domain/training/analytics";
import { buildSeasonStats } from "@/domain/training/stats";
import { buildGearTree } from "@/domain/training/gear";
import { buildCoachSummary } from "@/domain/coach-summary/buildCoachSummary";
import { gatherCoachSummaryContext } from "@/domain/coach-summary/gatherContext";
import { listValidCustomExercises } from "@/domain/exercises/resolve";
import {
  EXPORT_PURPOSES,
  type ExportPurpose,
  type SummaryModule,
} from "@/domain/schemas";

/**
 * Lesende Datenzugriffe des MCP-Servers. Jede Funktion filtert VERPFLICHTEND
 * nach `userId` (Multi-User-Regel des Projekts) und ändert nichts.
 */

/** Größtes erlaubtes Abfragefenster in Tagen. */
export const MAX_RANGE_DAYS = 400;

export class McpInputError extends Error {}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parst YYYY-MM-DD strikt (inkl. Kalendergültigkeit). */
export function parseDateArg(value: string, label: string): Date {
  if (!ISO_DATE.test(value)) throw new McpInputError(`${label}: erwartet YYYY-MM-DD`);
  const d = parseIsoDate(value);
  if (Number.isNaN(d.getTime()) || formatIsoDate(d) !== value) {
    throw new McpInputError(`${label}: ungültiges Datum`);
  }
  return d;
}

/** Löst ein optionales Datumspaar auf (inklusive Ende) und begrenzt das Fenster. */
export function resolveRange(
  from: string | undefined,
  to: string | undefined,
  defaults: { backDays: number; forwardDays: number },
  now: Date = new Date(),
): { from: Date; toInclusive: Date } {
  const start = from ? parseDateArg(from, "from") : addDays(parseIsoDate(formatIsoDate(now)), -defaults.backDays);
  const end = to ? parseDateArg(to, "to") : addDays(parseIsoDate(formatIsoDate(now)), defaults.forwardDays);
  if (end.getTime() < start.getTime()) throw new McpInputError("to liegt vor from");
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  if (days > MAX_RANGE_DAYS) throw new McpInputError(`Zeitfenster zu groß (max. ${MAX_RANGE_DAYS} Tage)`);
  // Datumsspalten liegen auf UTC-Mitternacht; Ende inklusive bis 23:59:59.999.
  return { from: start, toInclusive: new Date(end.getTime() + 86_399_999) };
}

function iso(d: Date | null | undefined): string | null {
  return d ? formatIsoDate(d) : null;
}

function clampLimit(limit: number | undefined, def: number, max: number): number {
  if (limit == null || !Number.isFinite(limit)) return def;
  return Math.min(Math.max(1, Math.floor(limit)), max);
}

// ---------------------------------------------------------------------------

export async function getOverview(db: PrismaClient, userId: string, now: Date = new Date()) {
  const today = parseIsoDate(formatIsoDate(now));
  const weekStart = mondayOfIso(now);
  const weekStartDate = parseIsoDate(weekStart);
  const weekEndDate = new Date(addDays(weekStartDate, 7).getTime() - 1);

  const [
    athlete,
    activities,
    futurePlanned,
    weekPlanned,
    plannedRecent,
    races,
    goals,
    readiness,
    pain,
    body,
    pendingJobs,
    failedJobs,
  ] = await Promise.all([
    db.athleteProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.actualActivity.findMany({
      where: { userId, date: { gte: addDays(now, -365) } },
      orderBy: { date: "desc" },
      select: {
        id: true, date: true, sport: true, durationMin: true, distanceKm: true, load: true,
        rpe: true, avgHr: true, maxHr: true, avgPower: true, elevationGainM: true,
      },
    }),
    db.plannedWorkout.findMany({
      where: { userId, status: { in: ["planned", "synced"] }, date: { gte: today } },
      orderBy: { date: "asc" },
      take: 200,
    }),
    db.plannedWorkout.findMany({
      where: { userId, date: { gte: weekStartDate, lte: weekEndDate } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, sport: true, title: true, plannedDurationMin: true, status: true },
    }),
    db.plannedWorkout.findMany({
      where: { userId, date: { gte: addDays(today, -28), lte: addDays(today, 14) } },
      select: { id: true, date: true, sport: true, title: true, plannedDurationMin: true, status: true },
    }),
    db.raceEvent.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    db.trainingGoal.findMany({ where: { userId } }),
    db.readinessSnapshot.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    db.painSnapshot.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    db.bodyMetric.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    db.syncQueue.count({ where: { userId, status: "pending" } }),
    db.syncQueue.count({ where: { userId, status: "failed" } }),
  ]);

  const thresholdHr = athlete?.thresholdHr ?? null;
  const loadSeries = buildLoadSeries(activities.slice(0, 200), { today: now, thresholdHr });
  const form = interpretForm(loadSeries.current.tsb);
  const acwr = interpretAcwr(loadSeries.current.acwr);
  const weeklyVolume = buildWeeklyVolume(activities, { weeks: 8, today: now });

  const upcoming = races.filter((r) => !r.completed && daysUntilRace(formatIsoDate(r.date), now) >= 0);
  const nextRace = upcoming.find((r) => r.priority === "A") ?? upcoming[0] ?? null;
  const daysToRace = nextRace ? daysUntilRace(formatIsoDate(nextRace.date), now) : null;

  const taper = forecastForm({
    startCtl: loadSeries.current.ctl,
    startAtl: loadSeries.current.atl,
    startDate: addDays(now, 1),
    raceDate: nextRace ? formatIsoDate(nextRace.date) : null,
    plannedLoads: futurePlanned.map((w) => ({
      date: formatIsoDate(w.date),
      load: estimateActivityLoad(
        { date: w.date, sport: w.sport, durationMin: w.plannedDurationMin, load: null, rpe: w.rpe },
        thresholdHr,
      ),
    })),
  });

  const planRows = buildPlanVsActual(
    plannedRecent,
    activities.filter((a) => a.date.getTime() >= addDays(today, -28).getTime()),
    now,
  );

  const todayIso = formatIsoDate(now);
  return {
    today: todayIso,
    athlete: athlete && {
      name: athlete.name, heightCm: athlete.heightCm, weightKg: athlete.weightKg,
      ftpWatts: athlete.ftpWatts, thresholdHr: athlete.thresholdHr,
      thresholdPaceSecPerKm: athlete.thresholdPaceSecPerKm,
      thresholdSwimPer100m: athlete.thresholdSwimPer100m,
      trainingLevel: athlete.trainingLevel, primarySports: athlete.primarySports,
      knownLimiters: athlete.knownLimiters, equipment: athlete.equipment,
    },
    form: {
      ctl: loadSeries.current.ctl,
      atl: loadSeries.current.atl,
      tsb: loadSeries.current.tsb,
      acwr: loadSeries.current.acwr,
      rampRatePerWeek: loadSeries.current.rampRate,
      formState: form,
      acwrAssessment: acwr,
    },
    weeklyVolumeMin: weeklyVolume,
    thisWeek: { weekStart, workouts: weekPlanned.map((w) => ({ ...w, date: iso(w.date) })) },
    todayPlanned: weekPlanned.filter((w) => formatIsoDate(w.date) === todayIso).map((w) => ({ ...w, date: iso(w.date) })),
    todayActual: activities.filter((a) => formatIsoDate(a.date) === todayIso).map((a) => ({ ...a, date: iso(a.date) })),
    last7Days: activities
      .filter((a) => a.date.getTime() >= addDays(today, -6).getTime())
      .map((a) => ({ ...a, date: iso(a.date) })),
    planCompliance: summarizeWeeklyCompliance(planRows),
    nextRace: nextRace && {
      id: nextRace.id, name: nextRace.name, date: iso(nextRace.date), type: nextRace.type,
      distance: nextRace.distance, priority: nextRace.priority, daysToRace,
      phase: daysToRace != null ? trainingPhase(daysToRace) : null,
    },
    taperForecast: {
      verdict: taper.verdict,
      recommendation: taper.recommendation,
      raceDay: taper.raceDay,
    },
    weeklyGoalsMin: Object.fromEntries(goals.map((g) => [g.sport, g.weeklyTargetMin])),
    readinessLatest: readiness && { ...readiness, date: iso(readiness.date), createdAt: undefined, userId: undefined },
    painLatest: pain && { ...pain, date: iso(pain.date), createdAt: undefined, userId: undefined },
    bodyLatest: body && { ...body, date: iso(body.date), createdAt: undefined, userId: undefined },
    sync: { pendingQueue: pendingJobs, failedQueue: failedJobs },
    intensityDistribution28d: intensityDistribution(
      activities.filter((a) => a.date.getTime() >= addDays(today, -28).getTime()),
    ),
    seasonStats: buildSeasonStats(activities, { today: now }),
  };
}

export async function getFormSeries(db: PrismaClient, userId: string, days = 60, now: Date = new Date()) {
  const n = Math.min(Math.max(7, Math.floor(days)), 365);
  const athlete = await db.athleteProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  const activities = await db.actualActivity.findMany({
    where: { userId, date: { gte: addDays(now, -(n + 120)) } },
    select: { date: true, sport: true, durationMin: true, load: true, rpe: true, avgHr: true },
    orderBy: { date: "desc" },
  });
  // Aufwärmphase: 120 Tage vor dem Fenster fließen in CTL/ATL ein.
  const full = buildLoadSeries(activities, { days: n + 120, today: now, thresholdHr: athlete?.thresholdHr ?? null });
  const slice = <T,>(arr: T[]) => arr.slice(-n);
  return {
    dates: slice(full.dates),
    dailyLoad: slice(full.dailyLoad),
    ctl: slice(full.ctl),
    atl: slice(full.atl),
    tsb: slice(full.tsb),
    current: full.current,
  };
}

export async function getActivities(
  db: PrismaClient,
  userId: string,
  args: { from?: string; to?: string; sport?: string; limit?: number; includeRaw?: boolean },
  now: Date = new Date(),
) {
  const { from, toInclusive } = resolveRange(args.from, args.to, { backDays: 30, forwardDays: 0 }, now);
  const rows = await db.actualActivity.findMany({
    where: { userId, date: { gte: from, lte: toInclusive }, ...(args.sport ? { sport: args.sport } : {}) },
    orderBy: { date: "desc" },
    take: clampLimit(args.limit, 50, 500),
  });
  return rows.map((a) => ({
    id: a.id,
    date: iso(a.date),
    sport: a.sport,
    source: a.source,
    durationMin: a.durationMin,
    distanceKm: a.distanceKm,
    load: a.load,
    rpe: a.rpe,
    avgHr: a.avgHr,
    maxHr: a.maxHr,
    avgPower: a.avgPower,
    elevationGainM: a.elevationGainM,
    notes: a.notes,
    ...(args.includeRaw ? { raw: a.rawJson } : {}),
  }));
}

export async function getPlannedWorkouts(
  db: PrismaClient,
  userId: string,
  args: { from?: string; to?: string; status?: string; includeSegments?: boolean; limit?: number },
  now: Date = new Date(),
) {
  const { from, toInclusive } = resolveRange(args.from, args.to, { backDays: 1, forwardDays: 14 }, now);
  const rows = await db.plannedWorkout.findMany({
    where: { userId, date: { gte: from, lte: toInclusive }, ...(args.status ? { status: args.status } : {}) },
    orderBy: { date: "asc" },
    take: clampLimit(args.limit, 100, 500),
  });
  return rows.map((w) => ({
    id: w.id,
    date: iso(w.date),
    sport: w.sport,
    title: w.title,
    plannedDurationMin: w.plannedDurationMin,
    plannedDistanceM: w.plannedDistanceM,
    rpe: w.rpe,
    description: w.description,
    status: w.status,
    source: w.source,
    ...(args.includeSegments ? { segments: w.segmentsJson } : {}),
  }));
}

export async function getPlanVsActual(
  db: PrismaClient,
  userId: string,
  args: { from?: string; to?: string },
  now: Date = new Date(),
) {
  const { from, toInclusive } = resolveRange(args.from, args.to, { backDays: 28, forwardDays: 7 }, now);
  const [planned, actual] = await Promise.all([
    db.plannedWorkout.findMany({
      where: { userId, date: { gte: from, lte: toInclusive } },
      select: { id: true, date: true, sport: true, title: true, plannedDurationMin: true, status: true },
    }),
    db.actualActivity.findMany({
      where: { userId, date: { gte: from, lte: toInclusive } },
      select: { id: true, date: true, sport: true, durationMin: true, distanceKm: true },
    }),
  ]);
  const rows = buildPlanVsActual(planned, actual, now);
  return { rows, weeks: summarizeWeeklyCompliance(rows) };
}

export async function getWellbeing(db: PrismaClient, userId: string, days = 30, now: Date = new Date()) {
  const n = Math.min(Math.max(1, Math.floor(days)), MAX_RANGE_DAYS);
  const since = addDays(now, -n);
  const [readiness, pain, body, journal] = await Promise.all([
    db.readinessSnapshot.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "desc" }, take: 500 }),
    db.painSnapshot.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "desc" }, take: 500 }),
    db.bodyMetric.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "desc" }, take: 500 }),
    db.journalEntry.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "desc" }, take: 200 }),
  ]);
  const strip = <T extends { date: Date; userId: string; createdAt: Date }>(r: T) => {
    const { userId: _u, createdAt: _c, date, ...rest } = r;
    void _u;
    void _c;
    return { date: iso(date), ...rest };
  };
  return {
    readiness: readiness.map(strip),
    pain: pain.map(strip),
    body: body.map(strip),
    journal: journal.map(strip),
  };
}

export async function getProfile(db: PrismaClient, userId: string) {
  const [athlete, goals, races, gear, gearActivities, customExercises] = await Promise.all([
    db.athleteProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.trainingGoal.findMany({ where: { userId }, orderBy: { sport: "asc" } }),
    db.raceEvent.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    db.gearItem.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.actualActivity.findMany({
      where: { userId },
      select: { date: true, sport: true, distanceKm: true, durationMin: true },
    }),
    db.customExercise.findMany({ where: { userId }, select: { exerciseId: true } }),
  ]);
  return {
    athlete: athlete && { ...athlete, userId: undefined },
    weeklyGoals: goals.map((g) => ({ sport: g.sport, weeklyTargetMin: g.weeklyTargetMin })),
    races: races.map((r) => ({ ...r, userId: undefined, date: iso(r.date) })),
    gear: buildGearTree(gear, gearActivities),
    customExerciseIds: customExercises.map((c) => c.exerciseId),
  };
}

export async function getPerformanceModel(db: PrismaClient, userId: string, now: Date = new Date()) {
  const [athlete, races, acts] = await Promise.all([
    db.athleteProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.raceEvent.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    db.actualActivity.findMany({
      where: { userId, date: { gte: addDays(now, -365) }, sport: { in: ["run", "bike", "swim"] } },
      select: {
        date: true, sport: true, durationMin: true, distanceKm: true, avgHr: true,
        maxHr: true, avgPower: true, rpe: true, elevationGainM: true,
      },
    }),
  ]);
  return buildPerformanceModel({
    activities: acts.map(perfActivityFromRow),
    races: races.map((r) => ({
      date: r.date, type: r.type, distance: r.distance,
      resultSeconds: r.resultSeconds, completed: r.completed,
    })),
    thresholdHr: athlete?.thresholdHr ?? null,
    thresholdPaceSecPerKm: athlete?.thresholdPaceSecPerKm ?? null,
    ftpWatts: athlete?.ftpWatts ?? null,
    cssPer100m: athlete?.thresholdSwimPer100m ?? null,
    today: now,
  });
}

/** Ernährungsdaten: nur mit gesetzter Einwilligung (DSGVO Art. 9) – wie in der UI. */
export async function getNutrition(
  db: PrismaClient,
  userId: string,
  args: { from?: string; to?: string },
  now: Date = new Date(),
) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { nutritionConsentAt: true } });
  if (!user?.nutritionConsentAt) {
    return {
      error: "NUTRITION_CONSENT_REQUIRED",
      message: "Einwilligung zur Verarbeitung von Ernährungsdaten fehlt. Sie kann nur in der LocalHub-App erteilt werden.",
    };
  }
  const { from, toInclusive } = resolveRange(args.from, args.to, { backDays: 7, forwardDays: 0 }, now);
  const [logs, target] = await Promise.all([
    db.foodLog.findMany({
      where: { userId, date: { gte: from, lte: toInclusive } },
      orderBy: { date: "desc" },
      take: 1000,
      include: { foodProduct: { select: { name: true } } },
    }),
    db.dailyNutritionTarget.findUnique({ where: { userId } }),
  ]);
  const byDay = new Map<string, { kcal: number; proteinG: number; carbsG: number; fatG: number }>();
  for (const l of logs) {
    const key = formatIsoDate(l.date);
    const d = byDay.get(key) ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    d.kcal += l.kcal;
    d.proteinG += l.proteinG ?? 0;
    d.carbsG += l.carbsG ?? 0;
    d.fatG += l.fatG ?? 0;
    byDay.set(key, d);
  }
  return {
    target: target && {
      targetKcal: target.targetKcal, targetProteinG: target.targetProteinG,
      targetCarbsG: target.targetCarbsG, targetFatG: target.targetFatG,
    },
    dailyTotals: [...byDay.entries()].sort().map(([date, t]) => ({
      date, kcal: Math.round(t.kcal), proteinG: Math.round(t.proteinG),
      carbsG: Math.round(t.carbsG), fatG: Math.round(t.fatG),
    })),
    logs: logs.map((l) => ({
      date: iso(l.date), food: l.foodProduct.name, quantityG: l.quantityG, kcal: l.kcal,
      proteinG: l.proteinG, carbsG: l.carbsG, fatG: l.fatG, notes: l.notes,
    })),
  };
}

/**
 * Baut eine coach_summary (wie /api/coach-summary), speichert sie aber NICHT.
 * Enthält bei exportPurpose "training_plan" Planformat, Regeln und Übungskatalog.
 */
export async function getCoachSummary(
  db: PrismaClient,
  userId: string,
  args: {
    exportPurpose?: string;
    planStart?: string;
    planDays?: number;
    includeModules?: SummaryModule[];
    excludeModules?: SummaryModule[];
  },
  now: Date = new Date(),
) {
  const exportPurpose = (
    EXPORT_PURPOSES.includes(args.exportPurpose as ExportPurpose) ? args.exportPurpose : "training_plan"
  ) as ExportPurpose;
  const planStart = args.planStart
    ? formatIsoDate(parseDateArg(args.planStart, "planStart"))
    : formatIsoDate(addDays(now, 1));
  const planDays = args.planDays && args.planDays > 0 ? Math.min(Math.round(args.planDays), 90) : 7;

  const { context, athleteId } = await gatherCoachSummaryContext(db, { userId, now });
  const customExercises = await listValidCustomExercises(userId, db);
  return buildCoachSummary({
    exportPurpose,
    athleteId,
    customExercises,
    planStart,
    planDays,
    includeModules: args.includeModules,
    excludeModules: args.excludeModules,
    context,
  });
}
