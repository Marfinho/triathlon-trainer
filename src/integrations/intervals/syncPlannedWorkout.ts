import type { PrismaClient } from "@prisma/client";
import { formatIsoDate } from "@/domain/training/dates";
import {
  hashWorkout,
  parseSegments,
  type HashableWorkout,
} from "./hashWorkout";
import {
  SPORT_TO_INTERVALS_TYPE,
  type IntervalsClient,
  type IntervalsEventInput,
} from "./client";

/**
 * Synchronisiert ein einzelnes geplantes Workout nach Intervals.icu –
 * idempotent.
 *
 * Vorgehen:
 *  - Hash des Workouts berechnen, mit `lastSyncedHash` vergleichen.
 *  - Identisch + bereits verknüpft -> kein API-Call ("skipped").
 *  - Verknüpft + geändert -> updateEvent ("updated").
 *  - Noch nicht verknüpft -> zuerst nach passendem Event suchen (Duplikat-
 *    Vermeidung); gefunden -> verknüpfen + update ("linked"), sonst create
 *    ("created").
 *  - IntervalsWorkoutSync + Hash speichern, Workout-Status auf "synced",
 *    SyncLog schreiben.
 *
 * Completed/replaced/cancelled Workouts werden nie nach Intervals geschrieben.
 */

export type SyncAction = "skipped" | "created" | "updated" | "linked" | "noop";

export interface SyncOutcome {
  action: SyncAction;
  workoutId: string;
  intervalsEventId?: string;
  hash?: string;
}

export interface SyncDeps {
  db: PrismaClient;
  client: IntervalsClient;
  triggeredBy?: string;
}

const SYNCABLE_STATUSES = new Set(["planned", "synced"]);

interface WorkoutRecord {
  id: string;
  date: Date;
  sport: string;
  title: string;
  plannedDurationMin: number;
  plannedDistanceM: number | null;
  description: string | null;
  segmentsJson: string;
  status: string;
}

function toHashable(w: WorkoutRecord): HashableWorkout {
  return {
    date: formatIsoDate(w.date),
    sport: w.sport,
    title: w.title,
    plannedDurationMin: w.plannedDurationMin,
    plannedDistanceM: w.plannedDistanceM,
    description: w.description,
    segments: parseSegments(w.segmentsJson),
  };
}

function toEventInput(w: WorkoutRecord): IntervalsEventInput {
  return {
    date: formatIsoDate(w.date),
    type: SPORT_TO_INTERVALS_TYPE[w.sport] ?? "Workout",
    name: w.title,
    description: w.description,
    durationMin: w.plannedDurationMin,
    distanceM: w.plannedDistanceM,
    externalId: `localhub:${w.id}`,
  };
}

export async function syncPlannedWorkout(
  workoutId: string,
  deps: SyncDeps,
): Promise<SyncOutcome> {
  const { db, client } = deps;
  const triggeredBy = deps.triggeredBy ?? "manual_sync";

  const workout = (await db.plannedWorkout.findUnique({
    where: { id: workoutId },
  })) as WorkoutRecord | null;

  if (!workout) {
    return { action: "noop", workoutId };
  }
  // Niemals completed/replaced/cancelled/skipped nach Intervals schreiben.
  if (!SYNCABLE_STATUSES.has(workout.status) || workout.sport === "rest") {
    return { action: "noop", workoutId };
  }

  const hash = hashWorkout(toHashable(workout));
  const eventInput = toEventInput(workout);

  const sync = await db.intervalsWorkoutSync.findUnique({
    where: { localWorkoutId: workoutId },
  });

  // Identisch + bereits verknüpft -> kein API-Call.
  if (sync?.intervalsEventId && sync.lastSyncedHash === hash) {
    return {
      action: "skipped",
      workoutId,
      intervalsEventId: sync.intervalsEventId,
      hash,
    };
  }

  let intervalsEventId = sync?.intervalsEventId ?? null;
  let action: SyncAction;

  try {
    if (intervalsEventId) {
      await client.updateEvent(intervalsEventId, eventInput);
      action = "updated";
    } else {
      // Vor dem Erstellen nach vorhandenem Event suchen (Idempotenz).
      const existing = await client.findEvent(eventInput);
      if (existing) {
        intervalsEventId = existing.id;
        await client.updateEvent(existing.id, eventInput);
        action = "linked";
      } else {
        const created = await client.createEvent(eventInput);
        intervalsEventId = created.id;
        action = "created";
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.syncLog.create({
      data: {
        localWorkoutId: workoutId,
        intervalsEventId: intervalsEventId ?? undefined,
        action: "sync",
        triggeredBy,
        success: false,
        errorMessage: message,
      },
    });
    throw error;
  }

  const now = new Date();
  await db.intervalsWorkoutSync.upsert({
    where: { localWorkoutId: workoutId },
    create: {
      localWorkoutId: workoutId,
      intervalsEventId,
      lastSyncedAt: now,
      lastSyncedHash: hash,
      syncStatus: "synced",
    },
    update: {
      intervalsEventId,
      lastSyncedAt: now,
      lastSyncedHash: hash,
      syncStatus: "synced",
      syncConflictState: null,
    },
  });

  await db.plannedWorkout.update({
    where: { id: workoutId },
    data: { status: "synced" },
  });

  await db.syncLog.create({
    data: {
      localWorkoutId: workoutId,
      intervalsEventId: intervalsEventId ?? undefined,
      action,
      newStateJson: JSON.stringify({ hash, eventInput }),
      triggeredBy,
      success: true,
    },
  });

  return {
    action,
    workoutId,
    intervalsEventId: intervalsEventId ?? undefined,
    hash,
  };
}
