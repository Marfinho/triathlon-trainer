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
  const hrvTrend = trendLabel(bodySummary.hrvs) ?? "keine Daten";
  const restingHrTrend = trendLabel(bodySummary.restingHrs) ?? "keine Daten";
  // Die Reihe ist aufsteigend sortiert; die Veränderung gegenüber dem ältesten
  // Eintrag kommt fertig aus der Zusammenfassung (null: weniger als zwei Werte).
  const weightTrend =
    bodySummary.weightChange == null
      ? "→ keine Daten"
      : bodySummary.weightChange < 0
        ? "↓ abnehmend"
        : bodySummary.weightChange > 0
          ? "↑ zunehmend"
          : "→ stabil";

  const latestReadiness = readiness[0] ?? null;

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
          Brick
        </p>
        <h1 className="mt-3 text-[2rem] font-bold leading-none tracking-tight text-neutral-900 md:text-5xl">
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
          weightKgs={bodySummary.weights}
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
