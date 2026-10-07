import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { getOverview, getPerformanceModel } from "@/lib/mcp/readers";
import { addDays, formatIsoDate } from "@/domain/training/dates";
import { buildCalendar } from "@/domain/training/calendar";
import { buildPlanVsActual, summarizeWeeklyCompliance } from "@/domain/training/planVsActual";
import { buildGoalProgress } from "@/domain/training/goals";
import { buildSeasonStats } from "@/domain/training/stats";
import { summarizeBody } from "@/domain/training/body";
import { buildGearTree, type GearNode } from "@/domain/training/gear";
import { daysUntilRace, describeCountdown, trainingPhase } from "@/domain/training/races";
import { computeHrZones, computePaceZones, computePowerZones, computeSwimZones, type Zone } from "@/domain/training/zones";
import { describeCapacity, forecastRace } from "@/domain/training/performanceModel";
import { isGuidedWorkout } from "@/domain/exercises/guided";

/**
 * Datenaufbereitung der Brick-Bereiche für die Fire-TV-App (brick-tv):
 * Heute, Woche, Wettkampf, Extras, Profil. Flache, stabile JSON-Strukturen
 * (Vertrag: docs/TV_API.md); die Auswertung nutzt dieselben Domänen-
 * Funktionen wie Web-App und MCP-Server.
 */

type Db = PrismaClient;

/** Art einer geplanten Einheit aus Sicht der TV-App (was sie abspielen kann). */
export function tvKind(sport: string, segments: unknown): "bike" | "strength" | "other" {
  if (sport === "bike" || sport === "brick") return "bike";
  if (isGuidedWorkout(sport, segments)) return "strength";
  return "other";
}

export async function tvToday(userId: string, db: Db = defaultPrisma, now: Date = new Date()) {
  const o = await getOverview(db, userId, now);
  const todayIso = formatIsoDate(now);
  const [todayRows, goals, weekActivities] = await Promise.all([
    db.plannedWorkout.findMany({
      where: { userId, date: { gte: new Date(`${todayIso}T00:00:00.000Z`), lte: new Date(`${todayIso}T23:59:59.999Z`) } },
      orderBy: { date: "asc" },
    }),
    db.trainingGoal.findMany({ where: { userId }, orderBy: { sport: "asc" } }),
    db.actualActivity.findMany({
      where: { userId, date: { gte: addDays(now, -7) } },
      select: { date: true, sport: true, durationMin: true },
    }),
  ]);
  return {
    date: todayIso,
    athleteName: o.athlete?.name ?? null,
    planned: todayRows.map((w) => ({
      id: w.id,
      sport: w.sport,
      title: w.title,
      plannedDurationMin: w.plannedDurationMin,
      status: w.status,
      description: w.description,
      rpe: w.rpe,
      kind: tvKind(w.sport, w.segmentsJson),
    })),
    done: o.todayActual.map((a) => ({
      sport: a.sport,
      durationMin: a.durationMin,
      distanceKm: a.distanceKm,
      load: a.load,
      avgHr: a.avgHr,
      avgPower: a.avgPower,
    })),
    form: {
      ctl: round1(o.form.ctl),
      atl: round1(o.form.atl),
      tsb: round1(o.form.tsb),
      acwr: o.form.acwr != null ? Math.round(o.form.acwr * 100) / 100 : null,
      state: o.form.formState.state,
      label: o.form.formState.label,
      acwrLabel: o.form.acwrAssessment.label,
    },
    readiness: o.readinessLatest
      ? {
          date: o.readinessLatest.date,
          status: o.readinessLatest.status,
          subjectiveFatigue: o.readinessLatest.subjectiveFatigue,
          sleepTrend: o.readinessLatest.sleepTrend,
        }
      : null,
    painLatest: o.painLatest ? { date: o.painLatest.date, overall: o.painLatest.overall } : null,
    nextRace: o.nextRace
      ? {
          name: o.nextRace.name,
          date: (o.nextRace.date ?? "").slice(0, 10),
          daysToRace: o.nextRace.daysToRace,
          countdown: o.nextRace.daysToRace != null ? describeCountdown(o.nextRace.daysToRace) : null,
          phase: o.nextRace.phase?.label ?? null,
          priority: o.nextRace.priority,
        }
      : null,
    taper: o.nextRace ? { verdict: o.taperForecast.verdict, recommendation: o.taperForecast.recommendation } : null,
    weeklyGoals: buildGoalProgress(
      goals.map((g) => ({ sport: g.sport, weeklyTargetMin: g.weeklyTargetMin })),
      weekActivities,
      now,
    ),
  };
}

export async function tvWeek(userId: string, db: Db = defaultPrisma, now: Date = new Date()) {
  const windowStart = addDays(now, -14);
  const windowEnd = addDays(now, 21);
  const [planned, actuals, recent, goals] = await Promise.all([
    db.plannedWorkout.findMany({ where: { userId, date: { gte: windowStart, lte: windowEnd } }, orderBy: { date: "asc" } }),
    db.actualActivity.findMany({ where: { userId, date: { gte: windowStart, lte: windowEnd } } }),
    db.actualActivity.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 15 }),
    db.trainingGoal.findMany({ where: { userId }, orderBy: { sport: "asc" } }),
  ]);
  const kindById = new Map(planned.map((w) => [w.id, tvKind(w.sport, w.segmentsJson)]));
  const grid = buildCalendar(
    planned.map((w) => ({
      id: w.id,
      date: w.date,
      sport: w.sport,
      title: w.title,
      plannedDurationMin: w.plannedDurationMin,
      status: w.status,
      plannedDistanceM: w.plannedDistanceM,
      rpe: w.rpe,
      description: w.description,
    })),
    actuals.map((a) => ({
      date: a.date,
      sport: a.sport,
      durationMin: a.durationMin,
      distanceKm: a.distanceKm,
      load: a.load,
      rpe: a.rpe,
      avgHr: a.avgHr,
      avgPower: a.avgPower,
      source: a.source,
    })),
    { weeks: 4, weeksBefore: 1, today: now },
  );
  const rows = buildPlanVsActual(
    planned.map((w) => ({ id: w.id, date: w.date, sport: w.sport, title: w.title, plannedDurationMin: w.plannedDurationMin, status: w.status })),
    actuals.map((a) => ({ id: a.id, date: a.date, sport: a.sport, durationMin: a.durationMin, distanceKm: a.distanceKm })),
    now,
  );
  return {
    days: grid.flat().map((d) => ({
      date: d.date,
      isToday: d.isToday,
      inPast: d.inPast,
      items: d.items.map((i) => ({
        kind: i.kind,
        id: i.id ?? null,
        sport: i.sport,
        label: i.label,
        durationMin: i.durationMin,
        status: i.status ?? null,
        distanceKm: i.distanceKm ?? null,
        load: i.load ?? null,
        avgHr: i.avgHr ?? null,
        avgPower: i.avgPower ?? null,
        description: i.description ?? null,
        playable: i.id ? kindById.get(i.id) ?? "other" : "other",
      })),
    })),
    weeklyGoals: buildGoalProgress(
      goals.map((g) => ({ sport: g.sport, weeklyTargetMin: g.weeklyTargetMin })),
      actuals.map((a) => ({ date: a.date, sport: a.sport, durationMin: a.durationMin })),
      now,
    ),
    compliance: summarizeWeeklyCompliance(rows),
    recent: recent.map((a) => ({
      date: formatIsoDate(a.date),
      sport: a.sport,
      durationMin: a.durationMin,
      distanceKm: a.distanceKm,
      load: a.load,
      source: a.source,
    })),
  };
}

export async function tvRace(userId: string, db: Db = defaultPrisma, now: Date = new Date()) {
  const [races, model] = await Promise.all([
    db.raceEvent.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    getPerformanceModel(db, userId, now),
  ]);
  return {
    races: races.map((r) => {
      const days = daysUntilRace(formatIsoDate(r.date), now);
      const forecast = !r.completed && days >= 0 ? forecastRace(r.type, r.distance, model) : null;
      return {
        id: r.id,
        name: r.name,
        date: formatIsoDate(r.date),
        type: r.type,
        distance: r.distance,
        priority: r.priority,
        location: r.locationName,
        completed: r.completed,
        resultSeconds: r.resultSeconds,
        resultPlacement: r.resultPlacement,
        daysToRace: days,
        countdown: describeCountdown(days),
        phase: !r.completed && days >= 0 ? trainingPhase(days).label : null,
        forecast: forecast && { label: forecast.label, ...forecast.corridor, confidence: forecast.confidence },
      };
    }),
    capacity: {
      run: model.run ? describeCapacity("run", model.run) : null,
      bike: model.bike ? describeCapacity("bike", model.bike) : null,
      swim: model.swim ? describeCapacity("swim", model.swim) : null,
    },
  };
}

export async function tvExtras(userId: string, db: Db = defaultPrisma, now: Date = new Date()) {
  const [athlete, activities, gearItems, body, journal] = await Promise.all([
    db.athleteProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.actualActivity.findMany({
      where: { userId },
      select: { date: true, sport: true, durationMin: true, distanceKm: true, load: true },
    }),
    db.gearItem.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.bodyMetric.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 30 }),
    db.journalEntry.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 8 }),
  ]);
  const zones = (title: string, unit: string, list: Zone[] | null) =>
    list ? { title, unit, zones: list.map((z) => ({ name: z.name, lo: z.lo, hi: z.hi, color: z.color })) } : null;
  return {
    zones: [
      zones("Leistung", "W", athlete?.ftpWatts ? computePowerZones(athlete.ftpWatts) : null),
      zones("Herzfrequenz", "bpm", athlete?.thresholdHr ? computeHrZones(athlete.thresholdHr) : null),
      zones("Lauf-Pace", "s/km", athlete?.thresholdPaceSecPerKm ? computePaceZones(athlete.thresholdPaceSecPerKm) : null),
      zones("Schwimm-Pace", "s/100 m", athlete?.thresholdSwimPer100m ? computeSwimZones(athlete.thresholdSwimPer100m) : null),
    ].filter((z) => z !== null),
    seasonStats: buildSeasonStats(activities, { today: now }),
    body: summarizeBody(body.map((b) => ({ date: b.date, weightKg: b.weightKg, restingHr: b.restingHr, hrv: b.hrv }))),
    gear: flattenGear(buildGearTree(gearItems, activities)),
    journal: journal.map((j) => ({ date: formatIsoDate(j.date), mood: j.mood, text: j.text.slice(0, 500) })),
  };
}

function flattenGear(nodes: GearNode[], depth = 0): Array<{
  name: string; type: string; sport: string | null; depth: number; retired: boolean;
  km: number; hours: number; kmPct: number | null; status: string;
}> {
  return nodes.flatMap((n) => [
    {
      name: n.name,
      type: n.type,
      sport: n.sport,
      depth,
      retired: n.retired,
      km: Math.round(n.usage.km),
      hours: Math.round(n.usage.hours * 10) / 10,
      kmPct: n.usage.kmPct,
      status: n.usage.status,
    },
    ...flattenGear(n.components, depth + 1),
  ]);
}

export async function tvProfile(userId: string, db: Db = defaultPrisma) {
  const [user, athlete, goals, integrations] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true, plan: true } }),
    db.athleteProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.trainingGoal.findMany({ where: { userId }, orderBy: { sport: "asc" } }),
    db.userIntegration.findMany({ where: { userId }, select: { provider: true, enabled: true } }),
  ]);
  return {
    name: athlete?.name ?? user?.name ?? null,
    email: user?.email ?? null,
    plan: user?.plan ?? "free",
    athlete: athlete && {
      heightCm: athlete.heightCm,
      weightKg: athlete.weightKg,
      ftpWatts: athlete.ftpWatts,
      thresholdHr: athlete.thresholdHr,
      thresholdPaceSecPerKm: athlete.thresholdPaceSecPerKm,
      thresholdSwimPer100m: athlete.thresholdSwimPer100m,
      trainingLevel: athlete.trainingLevel,
    },
    weeklyGoals: goals.map((g) => ({ sport: g.sport, weeklyTargetMin: g.weeklyTargetMin })),
    integrations: integrations.map((i) => ({ provider: i.provider, enabled: i.enabled })),
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
