import type { PrismaClient } from "@prisma/client";
import { syncPlannedWorkout, type SyncDeps } from "./syncPlannedWorkout";
import type { IntervalsClient } from "./client";

/**
 * Verarbeitet ausstehende SyncQueue-Jobs. Jeder Job wird auf `processing`
 * gesetzt, ausgeführt und danach auf `success` oder `failed` aktualisiert.
 * `attempts` wird hochgezählt; fehlgeschlagene Jobs unterhalb von `maxAttempts`
 * bleiben für einen erneuten Lauf `pending`, aber erst nach einem
 * exponentiellen Backoff (`nextAttemptAt`) wieder aufgreifbar.
 */

export interface ProcessQueueOptions {
  db: PrismaClient;
  client: IntervalsClient;
  userId: string;
  limit?: number;
  maxAttempts?: number;
  triggeredBy?: string;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface ProcessQueueResult {
  processed: number;
  succeeded: number;
  failed: number;
}

/** 30s, 60s, 120s, ... gedeckelt auf `maxDelayMs`. */
function backoffDelayMs(attempts: number, baseDelayMs: number, maxDelayMs: number): number {
  return Math.min(baseDelayMs * 2 ** (attempts - 1), maxDelayMs);
}

export async function processSyncQueue(
  options: ProcessQueueOptions,
): Promise<ProcessQueueResult> {
  const { db, client, userId } = options;
  const limit = options.limit ?? 50;
  const maxAttempts = options.maxAttempts ?? 3;
  const triggeredBy = options.triggeredBy ?? "queue";
  const baseDelayMs = options.baseDelayMs ?? 30_000;
  const maxDelayMs = options.maxDelayMs ?? 30 * 60_000;

  const now = new Date();
  const jobs = await db.syncQueue.findMany({
    where: {
      status: "pending",
      userId,
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const deps: SyncDeps = { db, client, userId, triggeredBy };
  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    await db.syncQueue.update({
      where: { id: job.id },
      data: {
        status: "processing",
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });

    try {
      if (job.action === "delete") {
        if (job.intervalsEventId) {
          await client.deleteEvent(job.intervalsEventId);
          await db.intervalsWorkoutSync.updateMany({
            where: { intervalsEventId: job.intervalsEventId, userId },
            data: {
              syncStatus: "superseded",
              deletedOrSupersededAt: new Date(),
            },
          });
        }
        await db.syncLog.create({
          data: {
            userId,
            localWorkoutId: job.localWorkoutId,
            intervalsEventId: job.intervalsEventId,
            action: "delete",
            type: "sync",
            triggeredBy,
            success: true,
          },
        });
      } else {
        // create | update | move | replace -> idempotenter Workout-Sync.
        await syncPlannedWorkout(job.localWorkoutId, deps);
      }

      await db.syncQueue.update({
        where: { id: job.id },
        data: { status: "success", errorMessage: null, nextAttemptAt: null },
      });
      succeeded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = job.attempts + 1;
      // Unter maxAttempts erneut versuchen (zurück auf pending, aber erst nach
      // Backoff wieder aufgreifbar), sonst endgültig failed.
      const retry = attempts < maxAttempts;
      await db.syncQueue.update({
        where: { id: job.id },
        data: {
          status: retry ? "pending" : "failed",
          errorMessage: message,
          nextAttemptAt: retry
            ? new Date(Date.now() + backoffDelayMs(attempts, baseDelayMs, maxDelayMs))
            : null,
        },
      });
      failed++;
    }
  }

  return { processed: jobs.length, succeeded, failed };
}
