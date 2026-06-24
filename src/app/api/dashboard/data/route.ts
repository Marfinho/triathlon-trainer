import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { formatIsoDate, addDays, mondayOfIso } from "@/domain/training/dates";
import {
  buildLoadSeries,
  buildWeeklyVolume,
  interpretForm,
  estimateActivityLoad,
} from "@/domain/training/trainingLoad";
import { daysUntilRace } from "@/domain/training/races";
import {
  resolveRunReference,
  calibrateRiegelExponent,
  bestBikeReference,
  type PredictionProfile,
} from "@/domain/training/prediction";
import { forecastForm } from "@/domain/training/formForecast";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const todayStart = new Date(`${formatIsoDate(now)}T00:00:00.000Z`);
    const todayEnd = new Date(`${formatIsoDate(now)}T23:59:59.999Z`);
    const loadWindowStart = addDays(now, -90);
    const weekStart = mondayOfIso(now);
    const weekEnd = formatIsoDate(addDays(new Date(`${weekStart}T00:00:00.000Z`), 6));
    const weekStartDate = new Date(`${weekStart}T00:00:00.000Z`);
    const weekEndDate = new Date(`${weekEnd}T23:59:59.999Z`);

    const [
      todayPlanned,
      todayActual,
      weekPlanned,
      recentActivities,
      recentReadiness,
      latestBodyMetric,
      activeGoals,
      athlete,
      raceEvents,
      futurePlanned,
    ] = await Promise.all([
      prisma.plannedWorkout.findFirst({
        where: { userId: user.id, date: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.actualActivity.findFirst({
        where: { userId: user.id, date: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.plannedWorkout.findMany({
        where: { userId: user.id, date: { gte: weekStartDate, lte: weekEndDate } },
        orderBy: { date: "asc" },
      }),
      prisma.actualActivity.findMany({
        where: { userId: user.id, date: { gte: loadWindowStart } },
        orderBy: { date: "desc" },
        take: 100,
      }),
      prisma.readinessSnapshot.findMany({
        where: { userId: user.id, date: { gte: addDays(now, -7) } },
        orderBy: { date: "desc" },
        take: 7,
      }),
      prisma.bodyMetric.findFirst({
        where: { userId: user.id },
        orderBy: { date: "desc" },
      }),
      prisma.trainingGoal.findMany({
        where: { userId: user.id },
        take: 5,
      }),
      prisma.athleteProfile.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.raceEvent.findMany({
        where: { userId: user.id },
        orderBy: { date: "asc" },
      }),
      prisma.plannedWorkout.findMany({
        where: {
          userId: user.id,
          status: { in: ["planned", "synced"] },
          date: { gte: now },
        },
        orderBy: { date: "asc" },
        select: { date: true, sport: true, plannedDurationMin: true, rpe: true },
        take: 200,
      }),
    ]);

    const loadSeries = buildLoadSeries(recentActivities, { today: now });
    const form = interpretForm(loadSeries.current.tsb);
    const weeklyVolume = buildWeeklyVolume(recentActivities, { today: now });

    const upcoming = raceEvents.filter(
      (r) => !r.completed && daysUntilRace(formatIsoDate(r.date), now) >= 0,
    );
    const nextRace = upcoming.find((r) => r.priority === "A") ?? upcoming[0] ?? null;

    const predictionProfile: PredictionProfile = {
      thresholdPaceSecPerKm: athlete?.thresholdPaceSecPerKm ?? null,
      ftpWatts: athlete?.ftpWatts ?? null,
      cssPer100m: athlete?.thresholdSwimPer100m ?? null,
      weightKg: athlete?.weightKg ?? null,
      ctl: loadSeries.current.ctl,
      runReference: resolveRunReference({
        thresholdPaceSecPerKm: athlete?.thresholdPaceSecPerKm ?? null,
        runs: recentActivities.map((a) => ({
          sport: a.sport,
          distanceKm: a.distanceKm,
          durationMin: a.durationMin,
        })),
      }),
      riegelExponent: calibrateRiegelExponent(
        recentActivities.map((a) => ({
          sport: a.sport,
          distanceKm: a.distanceKm,
          durationMin: a.durationMin,
        })),
      ).exponent,
      bikeReference: bestBikeReference(
        recentActivities.map((a) => ({
          sport: a.sport,
          distanceKm: a.distanceKm,
          durationMin: a.durationMin,
          avgPower: a.avgPower,
        })),
      ),
    };

    const plannedLoads = futurePlanned.map((w) => ({
      date: formatIsoDate(w.date),
      load: estimateActivityLoad(
        {
          date: w.date,
          sport: w.sport,
          durationMin: w.plannedDurationMin,
          load: null,
          rpe: w.rpe,
        },
        athlete?.thresholdHr ?? null,
      ),
    }));
    const taper = forecastForm({
      startCtl: loadSeries.current.ctl,
      startAtl: loadSeries.current.atl,
      startDate: addDays(now, 1),
      raceDate: nextRace ? formatIsoDate(nextRace.date) : null,
      plannedLoads,
    });

    return NextResponse.json({
      today: {
        dateIso: formatIsoDate(now),
        planned: todayPlanned,
        actual: todayActual,
      },
      week: {
        weekStart,
        weekEnd,
        planned: weekPlanned,
      },
      races: {
        upcoming,
        nextRace,
      },
      predictionProfile,
      taper,
      training: {
        recentActivities,
        loadSeries,
        form,
        weeklyVolume,
      },
      readiness: {
        latest: recentReadiness[0] || null,
        history: recentReadiness,
      },
      body: {
        latestMetric: latestBodyMetric,
      },
      goals: {
        active: activeGoals,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/data error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
