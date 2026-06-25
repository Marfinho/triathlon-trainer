import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatIsoDate } from "@/domain/training/dates";
import { summarizeBody, trendLabel } from "@/domain/training/body";
import { BodyMetricsDetail } from "@/components/dashboard/BodyMetricsDetail";
import { BodyTrendsChart } from "@/components/dashboard/BodyTrendsChart";
import { TrainingZones } from "@/components/dashboard/TrainingZones";
import { BodyStatsGrid } from "@/components/dashboard/BodyStatsGrid";

export const dynamic = "force-dynamic";

export default async function BodyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  const userId = session.user.id;

  const [bodyMetrics, readiness, athlete] = await Promise.all([
    prisma.bodyMetric.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 365,
    }),
    prisma.readinessSnapshot.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 30,
    }),
    prisma.athleteProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
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

  const latestMetric = bodyMetrics[0] ?? null;
  const hrvTrend = trendLabel(bodySummary.hrvs);
  const restingHrTrend = trendLabel(bodySummary.restingHrs);
  const weightTrend = bodySummary.weightKgs.length > 1
    ? bodySummary.weightKgs[0] < bodySummary.weightKgs[bodySummary.weightKgs.length - 1]
      ? "↓ abnehmend"
      : bodySummary.weightKgs[0] > bodySummary.weightKgs[bodySummary.weightKgs.length - 1]
        ? "↑ zunehmend"
        : "→ stabil"
    : "→ keine Daten";

  const latestReadiness = readiness[0] ?? null;

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          LocalHub
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
          Körper
        </h1>
      </header>

      <div className="space-y-5">
        {/* Aktuelle Metriken */}
        <BodyStatsGrid
          latest={latestMetric}
          weightTrend={weightTrend}
          hrvTrend={hrvTrend}
          restingHrTrend={restingHrTrend}
          heightCm={athlete?.heightCm ?? null}
        />

        {/* Trainings-Zonen */}
        <TrainingZones
          ftp={athlete?.ftpWatts ?? null}
          thresholdHr={athlete?.thresholdHr ?? null}
          thresholdPaceSecPerKm={athlete?.thresholdPaceSecPerKm ?? null}
          thresholdSwimPer100m={athlete?.thresholdSwimPer100m ?? null}
        />

        {/* Trends */}
        <BodyTrendsChart
          bodyMetrics={bodyMetrics}
          weightKgs={bodySummary.weightKgs}
          restingHrs={bodySummary.restingHrs}
          hrvs={bodySummary.hrvs}
        />

        {/* Detaillierte Tabelle */}
        <BodyMetricsDetail
          metrics={bodyMetrics}
          readiness={latestReadiness}
        />
      </div>
    </main>
  );
}
