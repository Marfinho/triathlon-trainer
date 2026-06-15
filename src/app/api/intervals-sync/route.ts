import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processSyncQueue } from "@/integrations/intervals/syncQueue";
import { createIntervalsClientFromEnv } from "@/integrations/intervals/client";

/**
 * POST /api/intervals-sync
 * Verarbeitet ausstehende SyncQueue-Jobs (geplante Workouts -> Intervals.icu).
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
  return NextResponse.json({ ok: true, ...result });
}

/**
 * GET /api/intervals-sync
 * Liefert den aktuellen Sync-Zustand (Queue + Verknüpfungen).
 */
export async function GET() {
  const [pending, processing, failed, success, syncs] = await Promise.all([
    prisma.syncQueue.count({ where: { status: "pending" } }),
    prisma.syncQueue.count({ where: { status: "processing" } }),
    prisma.syncQueue.count({ where: { status: "failed" } }),
    prisma.syncQueue.count({ where: { status: "success" } }),
    prisma.intervalsWorkoutSync.count({ where: { syncStatus: "synced" } }),
  ]);

  return NextResponse.json({
    configured: Boolean(createIntervalsClientFromEnv()),
    queue: { pending, processing, failed, success },
    syncedWorkouts: syncs,
  });
}
