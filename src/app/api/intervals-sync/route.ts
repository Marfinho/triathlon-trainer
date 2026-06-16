import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { processSyncQueue } from "@/integrations/intervals/syncQueue";
import { importActivitiesFromIntervals } from "@/integrations/intervals/importActivities";
import { createIntervalsClientForUser } from "@/integrations/intervals/userClient";

/**
 * POST /api/intervals-sync
 * Vollständiger Abgleich mit Intervals.icu in beide Richtungen:
 *   1. geplante Workouts -> Intervals.icu (SyncQueue abarbeiten)
 *   2. Ist-Aktivitäten   <- Intervals.icu (Apple/Withings/Strava-Aggregat)
 */
export async function POST() {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const client = await createIntervalsClientForUser(userId);
  if (!client) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Intervals.icu ist nicht konfiguriert. Bitte verbinde Intervals.icu in den Integrationen.",
      },
      { status: 400 },
    );
  }

  const result = await processSyncQueue({
    db: prisma,
    client,
    userId,
    triggeredBy: "ui_sync",
  });

  let activities = null;
  try {
    activities = await importActivitiesFromIntervals({
      db: prisma,
      client,
      userId,
    });
  } catch (e) {
    activities = { error: e instanceof Error ? e.message : "Import fehlgeschlagen." };
  }

  return NextResponse.json({ ok: true, ...result, activities });
}

/**
 * GET /api/intervals-sync – aktueller Sync-Zustand (Queue + Verknüpfungen).
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const [pending, processing, failed, success, syncs, logs] = await Promise.all([
    prisma.syncQueue.count({ where: { userId, status: "pending" } }),
    prisma.syncQueue.count({ where: { userId, status: "processing" } }),
    prisma.syncQueue.count({ where: { userId, status: "failed" } }),
    prisma.syncQueue.count({ where: { userId, status: "success" } }),
    prisma.intervalsWorkoutSync.count({ where: { userId, syncStatus: "synced" } }),
    prisma.syncLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const integration = await prisma.userIntegration.findFirst({
    where: { userId, provider: "intervals", enabled: true },
  });
  const configured =
    Boolean(integration) ||
    Boolean(process.env.INTERVALS_ATHLETE_ID && process.env.INTERVALS_API_KEY);

  return NextResponse.json({
    configured,
    queue: { pending, processing, failed, success },
    syncedWorkouts: syncs,
    recentLogs: logs.map((l) => ({
      action: l.action,
      success: l.success,
      reason: l.reason,
      at: l.createdAt.toISOString(),
    })),
  });
}
