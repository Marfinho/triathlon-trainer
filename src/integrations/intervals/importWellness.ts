import type { PrismaClient } from "@prisma/client";
import { formatIsoDate, addDays } from "@/domain/training/dates";
import type { IntervalsClient } from "./client";

/**
 * Import von Ruhepuls/HRV (und Gewicht, falls noch leer) aus dem Intervals.icu-
 * Wellness-Endpunkt nach `BodyMetric`. So kommen Apple-Watch-Werte an, sobald
 * Intervals.icu sie erhält. Idempotent: userId+Datum ist der Schlüssel; vorhandene
 * Werte (z.B. von Withings oder manuell) werden nur ersetzt, wenn Intervals einen liefert,
 * das Gewicht wird nie überschrieben.
 */

export interface ImportWellnessResult {
  fetched: number;
  created: number;
  updated: number;
}

export interface ImportWellnessDeps {
  db: PrismaClient;
  client: IntervalsClient;
  userId: string;
  sinceDays?: number;
  today?: Date;
}

const positive = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

export async function importWellnessFromIntervals(
  deps: ImportWellnessDeps,
): Promise<ImportWellnessResult> {
  const { db, client, userId } = deps;
  const sinceDays = deps.sinceDays ?? 60;
  const today = deps.today ?? new Date();
  const rows = await client.listWellness(
    formatIsoDate(addDays(today, -(sinceDays - 1))),
    formatIsoDate(today),
  );

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const dateStr = (row.id ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

    const restingHrRaw = positive(row.restingHR);
    const hrvRaw = positive(row.hrv);
    const weightKg = positive(row.weight);
    const restingHr = restingHrRaw != null ? Math.round(restingHrRaw) : null;
    const hrv = hrvRaw != null ? Math.round(hrvRaw) : null;
    if (restingHr == null && hrv == null && weightKg == null) continue;

    const date = new Date(dateStr);
    const existing = await db.bodyMetric.findFirst({ where: { userId, date } });

    if (existing) {
      await db.bodyMetric.update({
        where: { id: existing.id },
        data: {
          restingHr: restingHr ?? existing.restingHr,
          hrv: hrv ?? existing.hrv,
          weightKg: existing.weightKg ?? weightKg,
        },
      });
      updated++;
    } else {
      await db.bodyMetric.create({
        data: { userId, date, weightKg, restingHr, hrv, notes: "From Intervals.icu" },
      });
      created++;
    }
  }

  return { fetched: rows.length, created, updated };
}
