import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { addDays, formatIsoDate } from "@/domain/training/dates";
import {
  buildLoadSeries,
  estimateActivityLoad,
  interpretForm,
} from "@/domain/training/trainingLoad";
import {
  intensityDistribution,
  sportBalance,
  buildMonthlyVolume,
  bestPaceBySport,
  efficiencyTrend,
  estimateCalories,
} from "@/domain/training/analytics";
import {
  weeklyRampRate,
  consistencyScore,
  recommendTraining,
} from "@/domain/training/loadAdvisor";
import { estimateVdot, vdotCategory } from "@/domain/training/vdot";
import { forecastForm } from "@/domain/training/formForecast";
import { bestRunReference } from "@/domain/training/prediction";
import { buildPlanVsActual, summarizeWeeklyCompliance } from "@/domain/training/planVsActual";
import { isLlmConfigured } from "@/integrations/llm/client";
import { ChatGptExchange } from "@/components/dashboard/ChatGptExchange";
import { FormForecastCard } from "@/components/dashboard/FormForecastCard";
import { TrainingInsights } from "@/components/dashboard/TrainingInsights";
import { ReadinessPain } from "@/components/dashboard/ReadinessPain";
import { summarizeBody, trendLabel } from "@/domain/training/body";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  const userId = session.user.id;

  const now = new Date();
  const loadWindowStart = addDays(now, -365);

  const [athlete, loadActivities, races, readiness, pain, bodyMetrics] =
    await Promise.all([
      prisma.athleteProfile.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.actualActivity.findMany({
        where: { userId, date: { gte: loadWindowStart } },
        orderBy: { date: "asc" },
        select: {
          date: true,
          sport: true,
          durationMin: true,
          distanceKm: true,
          load: true,
          rpe: true,
          avgHr: true,
          avgPower: true,
        },
      }),
      prisma.raceEvent.findMany({ where: { userId }, orderBy: { date: "asc" } }),
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
      prisma.bodyMetric.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 30,
      }),
    ]);

  const loadSeries = buildLoadSeries(
    loadActivities.map((a) => ({
      date: a.date,
      sport: a.sport,
      durationMin: a.durationMin,
      load: a.load,
      rpe: a.rpe,
      avgHr: a.avgHr,
    })),
    { days: 90, today: now, thresholdHr: athlete?.thresholdHr },
  );
  const form = interpretForm(loadSeries.current.tsb);

  const analyticsActs = loadActivities.map((a) => ({
    date: a.date,
    sport: a.sport,
    durationMin: a.durationMin,
    distanceKm: a.distanceKm,
    load: a.load,
    rpe: a.rpe,
    avgHr: a.avgHr,
    avgPower: a.avgPower,
  }));
  const intensity = intensityDistribution(analyticsActs);
  const balance = sportBalance(analyticsActs);
  const monthly = buildMonthlyVolume(analyticsActs);
  const bestPaces = bestPaceBySport(analyticsActs);
  const efficiency = efficiencyTrend(analyticsActs).map((p) => p.ef);
  const ramp = weeklyRampRate(loadActivities.map((a) => ({ date: a.date, load: a.load })));
  const recommendation = recommendTraining(
    loadSeries.current.tsb,
    loadSeries.current.acwr,
    form.state,
  );

  const runRef = bestRunReference(
    loadActivities.map((a) => ({
      sport: a.sport,
      distanceKm: a.distanceKm,
      durationMin: a.durationMin,
    })),
  );
  const vdotResult = runRef ? estimateVdot(runRef.distanceKm * 1000, runRef.timeSec) : null;
  const vdot = vdotResult
    ? { vdot: vdotResult.vdot, category: vdotCategory(vdotResult.vdot) }
    : null;
  const sevenDaysAgo = formatIsoDate(addDays(now, -7));
  const caloriesLast7d = analyticsActs
    .filter((a) => formatIsoDate(a.date) >= sevenDaysAgo)
    .reduce((sum, a) => sum + (estimateCalories(a, athlete?.weightKg ?? null) ?? 0), 0);

  const futurePlanned = await prisma.plannedWorkout.findMany({
    where: { userId, status: { in: ["planned", "synced"] }, date: { gte: now } },
    orderBy: { date: "asc" },
    select: { date: true, sport: true, plannedDurationMin: true, rpe: true },
    take: 200,
  });
  const nextRaceEvent =
    races.find((r) => r.date.getTime() >= now.getTime() && r.priority === "A") ??
    races.find((r) => r.date.getTime() >= now.getTime());
  const plannedLoads = futurePlanned.map((w) => ({
    date: formatIsoDate(w.date),
    load: estimateActivityLoad(
      { date: w.date, sport: w.sport, durationMin: w.plannedDurationMin, load: null, rpe: w.rpe },
      athlete?.thresholdHr ?? null,
    ),
  }));
  const forecast = forecastForm({
    startCtl: loadSeries.current.ctl,
    startAtl: loadSeries.current.atl,
    startDate: addDays(now, 1),
    raceDate: nextRaceEvent ? formatIsoDate(nextRaceEvent.date) : null,
    plannedLoads,
  });

  const consistency = consistencyScore({
    plannedCount: futurePlanned.length,
    completedCount: loadActivities.length,
  });

  const bodySummary = summarizeBody(
    bodyMetrics.map((b) => ({ date: b.date, weightKg: b.weightKg, restingHr: b.restingHr, hrv: b.hrv })),
  );
  const computedHrvTrend = trendLabel(bodySummary.hrvs);
  const computedRestingHrTrend = trendLabel(bodySummary.restingHrs);
  const readinessLatest = readiness[0] ?? null;
  const painLatest = pain[0] ?? null;
  const fatigueTrend = [...readiness].reverse().map((r) => r.subjectiveFatigue ?? null);
  const painTrend = [...pain].reverse().map((p) => p.overall ?? null);

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          LocalHub
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
          Coach
        </h1>
      </header>
      <div className="space-y-5">
        <ChatGptExchange llmConfigured={isLlmConfigured()} />
        <FormForecastCard
          series={forecast.series}
          raceDay={forecast.raceDay}
          verdict={forecast.verdict}
          recommendation={forecast.recommendation}
          raceName={nextRaceEvent?.name ?? null}
        />
        <TrainingInsights
          intensity={intensity}
          recommendation={recommendation}
          sportShares={balance.shares}
          sportWarning={balance.warning}
          monthly={monthly}
          bestPaces={bestPaces}
          efficiencyValues={efficiency}
          vdot={vdot}
          consistency={consistency}
          rampRatio={ramp.latestRatio}
          rampRisk={ramp.risk}
          caloriesLast7d={caloriesLast7d > 0 ? caloriesLast7d : null}
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
    </main>
  );
}
