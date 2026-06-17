import type { PrismaClient } from "@prisma/client";
import {
  WITHINGS_WEIGHT_TYPE,
  WITHINGS_HEART_PULSE_TYPE,
  type WithingsClient,
  type WithingsMeasureGroup,
} from "./client";

/**
 * Import von Körperdaten aus Withings nach LocalHub (`BodyMetric`).
 *
 * Upsert-basiert (Schlüssel: source="withings" + externalId=grpid) und damit
 * idempotent – wiederholte Läufe erzeugen keine Duplikate. Manuell erfasste
 * Einträge (source="manual") bleiben unberührt.
 */
export interface ImportBodyResult {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
}

export interface ImportWithingsBodyDeps {
  db: PrismaClient;
  client: WithingsClient;
  userId: string;
  sinceDays?: number;
  today?: Date;
}

/** Wandelt einen Withings-Messwert (`value * 10^unit`) in einen realen Wert. */
function measureValue(grp: WithingsMeasureGroup, type: number): number | null {
  const m = grp.measures.find((x) => x.type === type);
  if (!m) return null;
  return m.value * Math.pow(10, m.unit);
}

export async function importWithingsBody(
  deps: ImportWithingsBodyDeps,
): Promise<ImportBodyResult> {
  const { db, client, userId } = deps;
  const sinceDays = deps.sinceDays ?? 90;
  const today = deps.today ?? new Date();
  const startUnix = Math.floor((today.getTime() - sinceDays * 86_400_000) / 1000);

  const groups = await client.listBodyMeasurements(startUnix);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const grp of groups) {
    if (!grp || grp.grpid == null || !Array.isArray(grp.measures)) {
      skipped++;
      continue;
    }

    const rawWeight = measureValue(grp, WITHINGS_WEIGHT_TYPE);
    const rawHr = measureValue(grp, WITHINGS_HEART_PULSE_TYPE);
    const weightKg = rawWeight != null ? Math.round(rawWeight * 10) / 10 : null;
    const restingHr = rawHr != null ? Math.round(rawHr) : null;
    if (weightKg == null && restingHr == null) {
      skipped++;
      continue;
    }

    const externalId = String(grp.grpid);
    const data = {
      userId,
      source: "withings",
      externalId,
      date: new Date(grp.date * 1000),
      weightKg,
      restingHr,
    };

    const existing = await db.bodyMetric.findUnique({
      where: {
        userId_source_externalId: { userId, source: "withings", externalId },
      },
    });

    if (existing) {
      await db.bodyMetric.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.bodyMetric.create({ data });
      created++;
    }
  }

  return { fetched: groups.length, created, updated, skipped };
}
