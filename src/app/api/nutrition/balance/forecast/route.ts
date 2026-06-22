import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { requireNutritionConsent } from "@/lib/nutrition-consent";
import { estimateCalories } from "@/domain/training/analytics";
import { formatIsoDate, parseIsoDate, addDays } from "@/domain/training/dates";
import {
  forecastEnergyBurn,
  aggregateForecastByDay,
  type PlannedWorkoutForForecast,
} from "@/domain/nutrition/forecast";
import type { ProfileSegmentInput } from "@/domain/training/workoutProfile";

const MIN_DAYS = 1;
const MAX_DAYS = 7;
const HISTORY_LOOKBACK_DAYS = 90;

/**
 * GET /api/nutrition/balance/forecast?days=3..7 – geschätzter Energiebedarf
 * für die kommenden geplanten Einheiten. Jede Schätzung trägt `source` +
 * `confidence` (siehe src/domain/nutrition/forecast.ts) – keine Blackbox-Zahl.
 */
export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const consent = await requireNutritionConsent(user.userId);
  if (!consent.ok) return consent.response;

  const url = new URL(request.url);
  const daysParam = Number(url.searchParams.get("days") ?? "3");
  const days = Number.isFinite(daysParam) ? Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(daysParam))) : 3;

  const today = parseIsoDate(formatIsoDate(new Date()));
  const rangeStart = today;
  const rangeEnd = addDays(today, days);

  const [planned, profile, historyActivities] = await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { userId: user.userId, date: { gte: rangeStart, lt: rangeEnd } },
      orderBy: { date: "asc" },
    }),
    prisma.athleteProfile.findFirst({ where: { userId: user.userId }, orderBy: { createdAt: "asc" } }),
    prisma.actualActivity.findMany({
      where: {
        userId: user.userId,
        date: { gte: addDays(today, -HISTORY_LOOKBACK_DAYS), lt: today },
        durationMin: { gt: 0 },
      },
    }),
  ]);

  const weightKg = profile?.weightKg ?? null;
  const ftpWatts = profile?.ftpWatts ?? 0;

  // Historischer Ø-kcal/min je Sportart aus den eigenen Ist-Aktivitäten – nur
  // als letzter Fallback, wenn weder Power noch Gewicht vorliegen.
  const kcalPerMinBySport = new Map<string, { sum: number; count: number }>();
  for (const a of historyActivities) {
    if (a.durationMin == null || a.durationMin <= 0) continue;
    const kcal = estimateCalories(
      {
        date: a.date,
        sport: a.sport,
        durationMin: a.durationMin,
        distanceKm: a.distanceKm,
        load: a.load,
        rpe: a.rpe,
        avgHr: a.avgHr,
        avgPower: a.avgPower,
      },
      weightKg,
    );
    if (kcal == null) continue;
    const entry = kcalPerMinBySport.get(a.sport) ?? { sum: 0, count: 0 };
    entry.sum += kcal / a.durationMin;
    entry.count += 1;
    kcalPerMinBySport.set(a.sport, entry);
  }
  const historyAvgKcalPerMinBySport: Record<string, number> = {};
  for (const [sport, { sum, count }] of kcalPerMinBySport) {
    historyAvgKcalPerMinBySport[sport] = sum / count;
  }

  const forecastInputs: PlannedWorkoutForForecast[] = planned.map((w) => ({
    date: formatIsoDate(w.date),
    sport: w.sport,
    plannedDurationMin: w.plannedDurationMin,
    segments: Array.isArray(w.segmentsJson)
      ? (w.segmentsJson as unknown as ProfileSegmentInput[])
      : null,
  }));

  const perWorkout = forecastEnergyBurn(forecastInputs, {
    ftpWatts,
    weightKg,
    historyAvgKcalPerMinBySport,
  });
  const byDay = aggregateForecastByDay(perWorkout);

  return NextResponse.json({ ok: true, days, perWorkout, byDay });
}
