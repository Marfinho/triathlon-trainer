import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { requireNutritionConsent } from "@/lib/nutrition-consent";
import { estimateCalories } from "@/domain/training/analytics";
import { summarizeIntake } from "@/domain/nutrition/food";
import { computeDailyBalance } from "@/domain/nutrition/dailyBalance";

/**
 * GET /api/nutrition/balance/today?date=YYYY-MM-DD – Bilanz aus geloggter
 * Zufuhr (FoodLog) vs. verbrauchten kcal aus abgeschlossenen Aktivitäten
 * (ActualActivity, dieselbe Schätzung wie im Trainings-Dashboard). KEIN
 * BMR/TDEE – bewusst nur Zufuhr vs. Trainingsverbrauch.
 */
export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const consent = await requireNutritionConsent(user.userId);
  if (!consent.ok) return consent.response;

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const day = dateParam ? dateParam.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ ok: false, error: "Ungültiges Datum." }, { status: 400 });
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [logs, activities, profile, target] = await Promise.all([
    prisma.foodLog.findMany({ where: { userId: user.userId, date: { gte: start, lt: end } } }),
    prisma.actualActivity.findMany({
      where: { userId: user.userId, date: { gte: start, lt: end } },
    }),
    prisma.athleteProfile.findFirst({ where: { userId: user.userId }, orderBy: { createdAt: "asc" } }),
    prisma.dailyNutritionTarget.findUnique({ where: { userId: user.userId } }),
  ]);

  const intake = summarizeIntake(logs);
  const weightKg = profile?.weightKg ?? null;
  const burnedKcal = activities.reduce((sum, a) => {
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
    return sum + (kcal ?? 0);
  }, 0);

  const balance = computeDailyBalance({
    intakeKcal: intake.kcal,
    burnedKcal,
    targetKcal: target?.targetKcal ?? null,
  });

  return NextResponse.json({
    ok: true,
    date: day,
    intake,
    burnedKcal,
    target,
    balance,
  });
}
