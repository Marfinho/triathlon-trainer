import type { PrismaClient } from "@prisma/client";
import { formatIsoDate, addDays } from "@/domain/training/dates";
import type { IntervalsClient } from "./client";

/**
 * Import von Ist-Aktivitäten aus Intervals.icu nach LocalHub.
 *
 * Intervals.icu ist die zentrale Sammelstelle (Apple Health, Withings, Strava …);
 * LocalHub spiegelt diese Aktivitäten als `ActualActivity`. Der Import ist
 * upsert-basiert (Schlüssel: source+externalId) und damit idempotent – wiederholte
 * Läufe erzeugen keine Duplikate. Geplante Workouts werden nie berührt.
 */

/** Mapping Intervals.icu-Aktivitätstyp -> LocalHub-Sport. */
export const INTERVALS_TYPE_TO_SPORT: Record<string, string> = {
  Run: "run",
  TrailRun: "run",
  Treadmill: "run",
  Ride: "bike",
  VirtualRide: "bike",
  GravelRide: "bike",
  MountainBikeRide: "bike",
  Swim: "swim",
  OpenWaterSwim: "swim",
  "Weight Training": "strength",
  WeightTraining: "strength",
  Workout: "cross_training",
  Walk: "walk",
  Hike: "walk",
  Yoga: "mobility",
};

export function intervalsTypeToSport(type?: string | null): string {
  if (!type) return "other";
  return INTERVALS_TYPE_TO_SPORT[type] ?? "other";
}

export interface ImportActivitiesResult {
  fetched: number;
  created: number;
  updated: number;
}

export interface ImportActivitiesDeps {
  db: PrismaClient;
  client: IntervalsClient;
  sinceDays?: number;
  today?: Date;
}

export async function importActivitiesFromIntervals(
  deps: ImportActivitiesDeps,
): Promise<ImportActivitiesResult> {
  const { db, client } = deps;
  const sinceDays = deps.sinceDays ?? 60;
  const today = deps.today ?? new Date();
  const newest = formatIsoDate(today);
  const oldest = formatIsoDate(addDays(today, -(sinceDays - 1)));

  const activities = await client.listActivities(oldest, newest);

  let created = 0;
  let updated = 0;

  for (const a of activities) {
    if (!a.id) continue;
    const distanceM = typeof a.distance === "number" ? a.distance : null;
    const data = {
      source: "intervals",
      externalId: a.id,
      date: a.start_date_local ? new Date(a.start_date_local) : new Date(),
      sport: intervalsTypeToSport(a.type),
      durationMin:
        typeof a.moving_time === "number"
          ? Math.round((a.moving_time / 60) * 10) / 10
          : null,
      distanceM,
      distanceKm: distanceM != null ? Math.round(distanceM / 10) / 100 : null,
      load: typeof a.icu_training_load === "number" ? a.icu_training_load : null,
      avgHr:
        typeof a.average_heartrate === "number"
          ? Math.round(a.average_heartrate)
          : null,
      rawJson: JSON.stringify(a),
    };

    const existing = await db.actualActivity.findUnique({
      where: { source_externalId: { source: "intervals", externalId: a.id } },
    });

    if (existing) {
      await db.actualActivity.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.actualActivity.create({ data });
      created++;
    }
  }

  return { fetched: activities.length, created, updated };
}
