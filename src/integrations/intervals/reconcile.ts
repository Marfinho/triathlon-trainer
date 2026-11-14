import type { PrismaClient } from "@prisma/client";
import { addDays, formatIsoDate } from "@/domain/training/dates";
import {
  SPORT_TO_INTERVALS_TYPE,
  type IntervalsClient,
  type IntervalsEvent,
} from "./client";

/**
 * Abgleich der Intervals.icu-Kalendereinträge mit dem lokalen Plan:
 * entfernt veraltete und doppelte Einträge, die LocalHub selbst angelegt hat.
 *
 * Eigene Einträge erkennt man an `external_id = "localhub:<workoutId>"`.
 *  - Waise:   Eintrag zu einem Workout, das es nicht mehr gibt oder das ersetzt/
 *             storniert wurde (z. B. weil der Lösch-Job beim Planimport fehlschlug).
 *  - Dublette: mehrere Einträge mit derselben external_id (z. B. nach einem
 *             abgebrochenen Sync); behalten wird der mit dem Sync-Datensatz.
 *  - Fremde Dublette: Eintrag OHNE LocalHub-Kennung (von Hand/anderem Tool), der
 *             zu einem aktiven Workout am selben Tag mit gleichem Typ und Namen
 *             passt, obwohl LocalHub dafür einen eigenen Eintrag hat. Wird nur
 *             auf ausdrücklichen Wunsch gelöscht.
 * Absolvierte Workouts und Einträge anderer Herkunft bleiben sonst unangetastet.
 */

export const EXTERNAL_ID_PREFIX = "localhub:";

export interface LocalWorkoutRef {
  id: string;
  date: string; // YYYY-MM-DD
  sport: string;
  title: string;
  status: string;
}

export interface LocalSyncRef {
  localWorkoutId: string;
  intervalsEventId: string | null;
}

export interface ReconcileItem {
  eventId: string;
  date: string;
  name: string;
  reason: string;
}

export interface ReconcilePlan {
  orphans: ReconcileItem[];
  duplicates: ReconcileItem[];
  foreignDuplicates: ReconcileItem[];
}

const INACTIVE = new Set(["replaced", "cancelled"]);
const ACTIVE = new Set(["planned", "synced"]);

function eventDate(e: IntervalsEvent): string {
  return (e.start_date_local ?? "").slice(0, 10);
}

function norm(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Rein/testbar: bestimmt, welche Intervals-Einträge entfernt werden sollten. */
export function planReconcile(
  events: IntervalsEvent[],
  workouts: LocalWorkoutRef[],
  syncs: LocalSyncRef[],
): ReconcilePlan {
  const byId = new Map(workouts.map((w) => [w.id, w]));
  const syncByWorkout = new Map(syncs.map((s) => [s.localWorkoutId, s]));
  const plan: ReconcilePlan = { orphans: [], duplicates: [], foreignDuplicates: [] };
  const item = (e: IntervalsEvent, reason: string): ReconcileItem => ({
    eventId: String(e.id),
    date: eventDate(e),
    name: e.name ?? "",
    reason,
  });

  const own = events.filter((e) => (e.external_id ?? "").startsWith(EXTERNAL_ID_PREFIX));
  const groups = new Map<string, IntervalsEvent[]>();
  for (const e of own) {
    const key = e.external_id as string;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }

  const keptOwnForWorkout = new Set<string>();
  for (const [extId, list] of groups) {
    const workoutId = extId.slice(EXTERNAL_ID_PREFIX.length);
    const w = byId.get(workoutId);
    if (!w) {
      // Nur Einträge im geprüften Zeitraum, deren Workout lokal fehlt, gelten als Waise.
      for (const e of list) plan.orphans.push(item(e, "Workout existiert nicht mehr"));
      continue;
    }
    if (INACTIVE.has(w.status)) {
      for (const e of list)
        plan.orphans.push(item(e, w.status === "replaced" ? "Workout wurde durch einen neuen Plan ersetzt" : "Workout wurde storniert"));
      continue;
    }
    // Aktiv oder absolviert: bei Mehrfacheinträgen genau einen behalten.
    const linked = syncByWorkout.get(workoutId)?.intervalsEventId;
    const keep = list.find((e) => String(e.id) === linked) ?? list[0];
    keptOwnForWorkout.add(workoutId);
    for (const e of list) {
      if (e !== keep) plan.duplicates.push(item(e, "Mehrfach-Eintrag desselben Workouts"));
    }
  }

  // Fremde Dubletten: gleicher Tag + Typ + Name wie ein aktives Workout mit eigenem Eintrag.
  const activeKeys = new Map<string, LocalWorkoutRef>();
  for (const w of workouts) {
    if (!ACTIVE.has(w.status) || !keptOwnForWorkout.has(w.id)) continue;
    activeKeys.set(`${w.date}|${SPORT_TO_INTERVALS_TYPE[w.sport] ?? "Workout"}|${norm(w.title)}`, w);
  }
  for (const e of events) {
    if ((e.external_id ?? "").startsWith(EXTERNAL_ID_PREFIX)) continue;
    const key = `${eventDate(e)}|${e.type ?? ""}|${norm(e.name)}`;
    if (activeKeys.has(key)) plan.foreignDuplicates.push(item(e, "gleicher Tag, Typ und Name wie ein LocalHub-Eintrag"));
  }
  return plan;
}

export interface ReconcileOptions {
  db: PrismaClient;
  client: IntervalsClient;
  userId: string;
  /** Nur berichten, nichts löschen. */
  dryRun?: boolean;
  /** Auch fremde Dubletten löschen (Standard: nein). */
  deleteForeignDuplicates?: boolean;
  today?: Date;
}

export interface ReconcileResult extends ReconcilePlan {
  oldest: string;
  newest: string;
  checked: number;
  dryRun: boolean;
  deleted: number;
  failed: { eventId: string; error: string }[];
}

/** Zeitraum: 30 Tage zurück bis zum letzten geplanten Workout (mind. 120 Tage voraus). */
export async function reconcileIntervalsEvents(opts: ReconcileOptions): Promise<ReconcileResult> {
  const { db, client, userId } = opts;
  const today = opts.today ?? new Date();
  const oldest = formatIsoDate(addDays(today, -30));
  const lastPlanned = await db.plannedWorkout.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const minNewest = addDays(today, 120);
  const newestDate = lastPlanned && lastPlanned.date > minNewest ? lastPlanned.date : minNewest;
  const newest = formatIsoDate(newestDate);

  const [events, workouts, syncs] = await Promise.all([
    client.listEvents(oldest, newest),
    db.plannedWorkout.findMany({
      where: { userId },
      select: { id: true, date: true, sport: true, title: true, status: true },
    }),
    db.intervalsWorkoutSync.findMany({
      where: { userId },
      select: { localWorkoutId: true, intervalsEventId: true },
    }),
  ]);

  const plan = planReconcile(
    events,
    workouts.map((w) => ({ ...w, date: formatIsoDate(w.date) })),
    syncs,
  );
  const dryRun = Boolean(opts.dryRun);
  const toDelete = [
    ...plan.orphans,
    ...plan.duplicates,
    ...(opts.deleteForeignDuplicates ? plan.foreignDuplicates : []),
  ];

  const failed: { eventId: string; error: string }[] = [];
  let deleted = 0;
  if (!dryRun) {
    for (const it of toDelete) {
      try {
        await client.deleteEvent(it.eventId);
        deleted++;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // 404 = schon weg.
        if (/: 404\b/.test(message)) deleted++;
        else failed.push({ eventId: it.eventId, error: message });
      }
    }
    // Sync-Datensätze, deren Event gelöscht wurde, als abgelöst markieren.
    const ids = toDelete.map((t) => t.eventId);
    if (ids.length > 0) {
      await db.intervalsWorkoutSync.updateMany({
        where: { userId, intervalsEventId: { in: ids }, syncStatus: "synced" },
        data: { syncStatus: "superseded", deletedOrSupersededAt: new Date() },
      });
    }
  }
  return { ...plan, oldest, newest, checked: events.length, dryRun, deleted, failed };
}
