/**
 * Hilfsfunktion für automatisches Syncing zu Intervals.icu nach Änderungen
 * an geplanten Workouts. Diese Funktion sollte aufgerufen werden, wann immer
 * ein Workout erstellt, aktualisiert oder gelöscht wird.
 */

import { prisma } from "@/lib/db";
import { createIntervalsClientForUser } from "@/integrations/intervals/userClient";
import { syncPlannedWorkout } from "@/integrations/intervals/syncPlannedWorkout";

export interface SyncToIntervalsOptions {
  userId: string;
  workoutIds?: string[];
  triggeredBy?: string;
}

/**
 * Synchronisiert ein oder mehrere Workouts mit Intervals.icu.
 * Falls keine workoutIds angegeben, werden alle "planned" Workouts des Nutzers synchronisiert.
 */
export async function syncToIntervals(
  options: SyncToIntervalsOptions,
): Promise<{ synced: number; failed: number }> {
  const { userId, workoutIds, triggeredBy = "auto_sync" } = options;

  const client = await createIntervalsClientForUser(userId);
  if (!client) {
    return { synced: 0, failed: 0 };
  }

  let ids: string[] = workoutIds ?? [];

  if (ids.length === 0) {
    // Wenn keine IDs angegeben, sync alle "planned" Workouts
    const workouts = await prisma.plannedWorkout.findMany({
      where: { userId, status: "planned" },
      select: { id: true },
    });
    ids = workouts.map((w) => w.id);
  }

  let synced = 0;
  let failed = 0;

  for (const workoutId of ids) {
    try {
      await syncPlannedWorkout(workoutId, {
        db: prisma,
        client,
        userId,
        triggeredBy,
      });
      synced++;
    } catch (error) {
      failed++;
      console.error(`Failed to sync workout ${workoutId}:`, error);
    }
  }

  return { synced, failed };
}
