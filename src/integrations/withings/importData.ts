import type { PrismaClient } from "@prisma/client";
import { formatIsoDate, addDays } from "@/domain/training/dates";
import type { WithingsClient } from "./client";

export interface ImportWithingsDataResult {
  measurements: { fetched: number; created: number; updated: number };
  sleep: { fetched: number; created: number; updated: number };
  activities: { fetched: number; created: number; updated: number };
}

export interface ImportWithingsDataDeps {
  db: PrismaClient;
  client: WithingsClient;
  userId: string;
  sinceDays?: number;
  today?: Date;
}

/**
 * Import von Withings-Daten nach LocalHub.
 * - Gewicht/HR/HRV → BodyMetric
 * - Schlaf → ReadinessSnapshot
 * - Aktivitäten → ActualActivity
 *
 * Alles idempotent: userId+date ist der Schlüssel (upsert).
 */
export async function importWithingsData(
  deps: ImportWithingsDataDeps,
): Promise<ImportWithingsDataResult> {
  const { db, client, userId } = deps;
  const sinceDays = deps.sinceDays ?? 60;
  const today = deps.today ?? new Date();
  const startDate = addDays(today, -(sinceDays - 1));

  const measurements = await importMeasurements(db, client, userId, startDate, today);
  const sleep = await importSleep(db, client, userId, startDate, today);
  const activities = await importActivities(db, client, userId, startDate, today);

  return { measurements, sleep, activities };
}

/**
 * Importiere Weight/HR/HRV von Withings und speichere in BodyMetric.
 */
async function importMeasurements(
  db: PrismaClient,
  client: WithingsClient,
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  const measuregrps = await client.getMeasurements(startDate, endDate);

  let created = 0;
  let updated = 0;
  const processed = new Set<string>();

  for (const group of measuregrps) {
    const date = new Date(group.date * 1000);
    const dateStr = formatIsoDate(date);

    // Skip duplicates within same import
    if (processed.has(dateStr)) continue;
    processed.add(dateStr);

    let weightKg: number | null = null;
    let restingHr: number | null = null;
    let hrv: number | null = null;

    // Parse measure types
    for (const measure of group.measures || []) {
      if (measure.type === 1) {
        // weight in kg
        weightKg = measure.value / Math.pow(10, measure.unit);
      } else if (measure.type === 11) {
        // heart_pulse in bpm
        restingHr = Math.round(measure.value / Math.pow(10, measure.unit));
      } else if (measure.type === 88) {
        // hrv in ms
        hrv = Math.round(measure.value / Math.pow(10, measure.unit));
      }
    }

    // Only upsert if we have at least one metric
    if (!weightKg && !restingHr && !hrv) continue;

    const existing = await db.bodyMetric.findFirst({
      where: { userId, date: { equals: new Date(dateStr) } },
    });

    if (existing) {
      await db.bodyMetric.update({
        where: { id: existing.id },
        data: {
          weightKg: weightKg ?? existing.weightKg,
          restingHr: restingHr ?? existing.restingHr,
          hrv: hrv ?? existing.hrv,
          notes: existing.notes ? `${existing.notes}; Updated from Withings` : "From Withings",
        },
      });
      updated++;
    } else {
      await db.bodyMetric.create({
        data: {
          userId,
          date: new Date(dateStr),
          weightKg,
          restingHr,
          hrv,
          notes: "From Withings",
        },
      });
      created++;
    }
  }

  return { fetched: measuregrps.length, created, updated };
}

/**
 * Importiere Schlaf-Daten von Withings und speichere in ReadinessSnapshot.
 */
async function importSleep(
  db: PrismaClient,
  client: WithingsClient,
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  const sleepSessions = await client.getSleep(startDate, endDate);

  let created = 0;
  let updated = 0;

  for (const session of sleepSessions) {
    if (!session.date || !session.data) continue;

    const date = new Date(session.date);
    const sleepDurationHours = session.data.sleep_duration ? session.data.sleep_duration / 3600 : 0;

    // Map sleep duration to trend (simple heuristic)
    let sleepTrend: string;
    if (sleepDurationHours < 5) {
      sleepTrend = "poor";
    } else if (sleepDurationHours < 6) {
      sleepTrend = "fair";
    } else if (sleepDurationHours < 8) {
      sleepTrend = "good";
    } else {
      sleepTrend = "excellent";
    }

    const existing = await db.readinessSnapshot.findFirst({
      where: { userId, date: { equals: date } },
    });

    if (existing) {
      await db.readinessSnapshot.update({
        where: { id: existing.id },
        data: {
          sleepTrend,
          notes: existing.notes ? `${existing.notes}; Sleep: ${sleepDurationHours.toFixed(1)}h from Withings` : `Sleep: ${sleepDurationHours.toFixed(1)}h from Withings`,
        },
      });
      updated++;
    } else {
      await db.readinessSnapshot.create({
        data: {
          userId,
          date,
          sleepTrend,
          notes: `Sleep: ${sleepDurationHours.toFixed(1)}h from Withings`,
        },
      });
      created++;
    }
  }

  return { fetched: sleepSessions.length, created, updated };
}

/**
 * Importiere Aktivitäten von Withings und speichere in ActualActivity.
 * Nur Schritte/Gehen werden als separate Aktivitäten gespeichert (wenn Schritte > 0).
 */
async function importActivities(
  db: PrismaClient,
  client: WithingsClient,
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  const activities = await client.getActivities(startDate, endDate);

  let created = 0;
  let updated = 0;

  for (const activity of activities) {
    if (!activity.date || activity.steps === undefined || activity.steps === 0) {
      continue;
    }

    const date = new Date(`${activity.date}T00:00:00`);
    const durationMin = activity.duration ? Math.round((activity.duration / 60) * 10) / 10 : null;
    const distanceM = activity.distance || null;
    const distanceKm = distanceM ? Math.round(distanceM / 10) / 100 : null;
    const externalId = `withings_${activity.date}`;

    const data = {
      userId,
      source: "withings",
      externalId,
      date,
      sport: "walk", // Withings activities are primarily step tracking
      durationMin,
      distanceM,
      distanceKm,
      rpe: null,
      avgHr: activity.hr_avg ? Math.round(activity.hr_avg) : null,
      avgPower: null,
      notes: `Steps: ${activity.steps}, Calories: ${activity.calories}`,
      rawJson: activity as object,
    };

    const existing = await db.actualActivity.findUnique({
      where: {
        userId_source_externalId: {
          userId,
          source: "withings",
          externalId,
        },
      },
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
