import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processSyncQueue } from "@/integrations/intervals/syncQueue";
import { importActivitiesFromIntervals } from "@/integrations/intervals/importActivities";
import { createIntervalsClientFromEnv } from "@/integrations/intervals/client";

/**
 * POST /api/intervals-sync
 * Vollständiger Abgleich mit Intervals.icu in beide Richtungen:
 *   1. geplante Workouts -> Intervals.icu (SyncQueue abarbeiten)
 *   2. Ist-Aktivitäten   <- Intervals.icu (Apple/Withings/Strava-Aggregat)
 * Benötigt INTERVALS_ATHLETE_ID und INTERVALS_API_KEY in der Umgebung.
 */
export async function POST() {
  const client = createIntervalsClientFromEnv();
  if (!client) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Intervals.icu ist nicht konfiguriert. Bitte INTERVALS_ATHLETE_ID und INTERVALS_API_KEY setzen.",
      },
      { status: 400 },
    );
  }

  const result = await processSyncQueue({
    db: prisma,
    client,
    triggeredBy: "ui_sync",
  });

  let activities = null;
  try {
    activities = await importActivitiesFromIntervals({ db: prisma, client });
  } catch (e) {
    activities = { error: e instanceof Error ? e.message : "Import fehlgeschlagen." };
  }

  return NextResponse.json({ ok: true, ...result, activities });
}

/**
 * GET /api/intervals-sync
 * Liefert den aktuellen Sync-Zustand (Queue + Verknüpfungen).
 */
export async function GET() {
  const [pending, processing, failed, success, syncs, logs] = await Promise.all([
    prisma.syncQueue.count({ where: { status: "pending" } }),
    prisma.syncQueue.count({ where: { status: "processing" } }),
    prisma.syncQueue.count({ where: { status: "failed" } }),
    prisma.syncQueue.count({ where: { status: "success" } }),
    prisma.intervalsWorkoutSync.count({ where: { syncStatus: "synced" } }),
    prisma.syncLog.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return NextResponse.json({
    configured: Boolean(createIntervalsClientFromEnv()),
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
