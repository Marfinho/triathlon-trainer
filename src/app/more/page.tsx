import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getEffectiveLimits } from "@/lib/plan-config";
import { addDays, formatIsoDate } from "@/domain/training/dates";
import { buildSeasonStats } from "@/domain/training/stats";
import { buildGearTree } from "@/domain/training/gear";
import { summarizeBody } from "@/domain/training/body";
import type { TimelineSegmentInput } from "@/integrations/trainer/workoutPlayer";
import { TrainerControl, type TrainerWorkout } from "@/components/dashboard/TrainerControl";
import { TrainingZones } from "@/components/dashboard/TrainingZones";
import { TrainingCalculators } from "@/components/dashboard/TrainingCalculators";
import { GearTracker, type Gear } from "@/components/dashboard/GearTracker";
import { BodyMetrics } from "@/components/dashboard/BodyMetrics";
import { TrainingJournal } from "@/components/dashboard/TrainingJournal";
import { NutritionTab } from "@/components/dashboard/nutrition/NutritionTab";
import { SeasonStatsCard } from "@/components/dashboard/SeasonStats";
import { DataExport } from "@/components/dashboard/DataExport";
import { BackupRestore } from "@/components/dashboard/BackupRestore";
import { IntervalsSyncStatus } from "@/components/dashboard/IntervalsSyncStatus";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  const userId = session.user.id;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  const limits = await getEffectiveLimits(dbUser?.plan ?? "free");

  const now = new Date();
  const windowEnd = addDays(now, 21);

  const [
    bikeWorkouts,
    athlete,
    loadActivities,
    gearItems,
    gearActivities,
    bodyMetrics,
    journalEntries,
    syncCounts,
    syncLogs,
  ] = await Promise.all([
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
      where: { userId },
      orderBy: { date: "asc" },
      select: { date: true, sport: true, durationMin: true, distanceKm: true, load: true },
    }),
    prisma.gearItem.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.actualActivity.findMany({
      where: { userId },
      select: { date: true, sport: true, distanceKm: true, durationMin: true },
    }),
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
    Promise.all([
      prisma.syncQueue.count({ where: { userId, status: "pending" } }),
      prisma.syncQueue.count({ where: { userId, status: "processing" } }),
      prisma.syncQueue.count({ where: { userId, status: "failed" } }),
      prisma.syncQueue.count({ where: { userId, status: "success" } }),
      prisma.intervalsWorkoutSync.count({ where: { userId, syncStatus: "synced" } }),
    ]),
    prisma.syncLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

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
  const seasonStats = buildSeasonStats(loadActivities, { today: now });
  const bodySummary = summarizeBody(
    bodyMetrics.map((b) => ({ date: b.date, weightKg: b.weightKg, restingHr: b.restingHr, hrv: b.hrv })),
  );

  const [pending, processing, failed, success, synced] = syncCounts;
  const intervalsIntegration = await prisma.userIntegration.findFirst({
    where: { userId, provider: "intervals", enabled: true },
  });
  const intervalsConfigured = Boolean(
    intervalsIntegration ||
    (process.env.INTERVALS_ATHLETE_ID && process.env.INTERVALS_API_KEY),
  );

  let backupCooldownActive = false;
  let nextBackupAt: string | null = null;
  if (limits.manualBackupCooldownHours > 0) {
    const lastBackup = await prisma.syncLog.findFirst({
      where: { userId, type: "backup" },
      orderBy: { createdAt: "desc" },
    });
    if (lastBackup) {
      const next = new Date(
        lastBackup.createdAt.getTime() + limits.manualBackupCooldownHours * 3600 * 1000,
      );
      if (next.getTime() > now.getTime()) {
        backupCooldownActive = true;
        nextBackupAt = next.toISOString();
      }
    }
  }

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          LocalHub
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
          Mehr
        </h1>
      </header>
      <div className="space-y-5">
        <TrainerControl workouts={trainerWorkouts} defaultFtp={athlete?.ftpWatts ?? 200} />
        <TrainingZones
          ftp={athlete?.ftpWatts ?? null}
          thresholdHr={athlete?.thresholdHr ?? null}
          thresholdPaceSecPerKm={athlete?.thresholdPaceSecPerKm ?? null}
          thresholdSwimPer100m={athlete?.thresholdSwimPer100m ?? null}
        />
        <GearTracker initialGear={gearTree} />
        <BodyMetrics summary={bodySummary} heightCm={athlete?.heightCm ?? null} />
        <SeasonStatsCard stats={seasonStats} />
        <NutritionTab />
        <TrainingJournal
          initial={journalEntries.map((e) => ({
            id: e.id,
            date: e.date.toISOString(),
            mood: e.mood,
            text: e.text,
          }))}
        />
        <TrainingCalculators />
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
        <DataExport />
        <BackupRestore cooldownActive={backupCooldownActive} nextBackupAt={nextBackupAt} />
      </div>
    </main>
  );
}
