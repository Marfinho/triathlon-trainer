import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

/**
 * Backup-Format Version "2" – ein vollständiges, nutzerbezogenes JSON.
 * API-Keys werden NIE exportiert (nur provider/athleteId/enabled).
 */
export const BACKUP_VERSION = "2";

const recordSchema = z.object({ id: z.string() }).passthrough();

export const backupSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string().optional(),
  userId: z.string(),
  userEmail: z.string().optional(),
  data: z.object({
    profile: recordSchema.nullable().optional(),
    raceEvents: z.array(recordSchema).default([]),
    plannedWorkouts: z.array(recordSchema).default([]),
    actualActivities: z.array(recordSchema).default([]),
    gearItems: z.array(recordSchema).default([]),
    trainingGoals: z.array(recordSchema).default([]),
    bodyMetrics: z.array(recordSchema).default([]),
    journalEntries: z.array(recordSchema).default([]),
    readinessSnapshots: z.array(recordSchema).default([]),
    painSnapshots: z.array(recordSchema).default([]),
    integrations: z
      .array(
        z.object({
          provider: z.string(),
          athleteId: z.string().nullable().optional(),
          enabled: z.boolean().optional(),
        }),
      )
      .default([]),
  }),
});

export type BackupFile = z.infer<typeof backupSchema>;

export type ParseResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; error: "INVALID_FORMAT"; details: string }
  | { ok: false; error: "VALIDATION_FAILED"; issues: z.ZodIssue[] };

/** Prüft zuerst die Version, dann das vollständige Schema. */
export function parseBackup(raw: unknown): ParseResult {
  if (
    !raw ||
    typeof raw !== "object" ||
    (raw as { version?: unknown }).version !== BACKUP_VERSION
  ) {
    return {
      ok: false,
      error: "INVALID_FORMAT",
      details: `Erwartet version "${BACKUP_VERSION}".`,
    };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION_FAILED", issues: parsed.error.issues };
  }
  return { ok: true, backup: parsed.data };
}

// --- Export -----------------------------------------------------------------

export async function buildBackupForUser(
  db: PrismaClient,
  userId: string,
  userEmail: string,
): Promise<BackupFile> {
  const [
    profile,
    raceEvents,
    plannedWorkouts,
    actualActivities,
    gearItems,
    trainingGoals,
    bodyMetrics,
    journalEntries,
    readinessSnapshots,
    painSnapshots,
    integrations,
  ] = await Promise.all([
    db.athleteProfile.findFirst({ where: { userId } }),
    db.raceEvent.findMany({ where: { userId } }),
    db.plannedWorkout.findMany({ where: { userId } }),
    db.actualActivity.findMany({ where: { userId } }),
    db.gearItem.findMany({ where: { userId } }),
    db.trainingGoal.findMany({ where: { userId } }),
    db.bodyMetric.findMany({ where: { userId } }),
    db.journalEntry.findMany({ where: { userId } }),
    db.readinessSnapshot.findMany({ where: { userId } }),
    db.painSnapshot.findMany({ where: { userId } }),
    db.userIntegration.findMany({ where: { userId } }),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    userId,
    userEmail,
    data: {
      profile: (profile as unknown as Record<string, unknown>) ?? null,
      raceEvents: raceEvents as unknown as Record<string, unknown>[],
      plannedWorkouts: plannedWorkouts as unknown as Record<string, unknown>[],
      actualActivities: actualActivities as unknown as Record<string, unknown>[],
      gearItems: gearItems as unknown as Record<string, unknown>[],
      trainingGoals: trainingGoals as unknown as Record<string, unknown>[],
      bodyMetrics: bodyMetrics as unknown as Record<string, unknown>[],
      journalEntries: journalEntries as unknown as Record<string, unknown>[],
      readinessSnapshots: readinessSnapshots as unknown as Record<string, unknown>[],
      painSnapshots: painSnapshots as unknown as Record<string, unknown>[],
      // API-Keys werden bewusst NICHT exportiert.
      integrations: integrations.map((i) => ({
        provider: i.provider,
        athleteId: i.athleteId,
        enabled: i.enabled,
      })),
    },
  } as unknown as BackupFile;
}

// --- Restore ----------------------------------------------------------------

type Rec = Record<string, unknown>;
const s = (r: Rec, k: string): string | null =>
  typeof r[k] === "string" ? (r[k] as string) : null;
const n = (r: Rec, k: string): number | null =>
  typeof r[k] === "number" ? (r[k] as number) : null;
const bool = (r: Rec, k: string, def = false): boolean =>
  typeof r[k] === "boolean" ? (r[k] as boolean) : def;
const dt = (r: Rec, k: string): Date | null => {
  const v = r[k];
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

export interface RestoreResult {
  restored: Record<string, number>;
  skipped: number;
}

/**
 * Stellt ein Backup für `userId` wieder her – in EINER Transaktion (alles oder
 * nichts). Invarianten:
 *  - ActualActivity wird nie überschrieben (existiert id -> skip).
 *  - PlannedWorkouts mit status="completed" werden nie überschrieben.
 *  - Datensätze, die einem anderen User gehören, werden übersprungen.
 */
export async function restoreBackup(
  db: PrismaClient,
  userId: string,
  backup: BackupFile,
): Promise<RestoreResult> {
  const restored: Record<string, number> = {};
  let skipped = 0;
  const data = backup.data;

  await db.$transaction(async (tx) => {
    // Profil (einzeln, upsert).
    if (data.profile) {
      const r = data.profile as Rec;
      const id = String(r.id);
      const existing = await tx.athleteProfile.findUnique({ where: { id } });
      if (existing && existing.userId !== userId) {
        skipped++;
      } else {
        const payload = {
          userId,
          name: s(r, "name") ?? "Athlet",
          heightCm: n(r, "heightCm"),
          weightKg: n(r, "weightKg"),
          ftpWatts: n(r, "ftpWatts"),
          thresholdHr: n(r, "thresholdHr"),
          thresholdPaceSecPerKm: n(r, "thresholdPaceSecPerKm"),
          thresholdSwimPer100m: n(r, "thresholdSwimPer100m"),
          trainingLevel: s(r, "trainingLevel"),
          primarySports: (r.primarySports as object) ?? undefined,
          knownLimiters: (r.knownLimiters as object) ?? undefined,
          equipment: (r.equipment as object) ?? undefined,
        };
        await tx.athleteProfile.upsert({
          where: { id },
          create: { id, ...payload },
          update: payload,
        });
        restored.profile = 1;
      }
    }

    // Generischer Upsert-Helfer mit Ownership-Schutz.
    async function upsertList(
      key: string,
      list: Rec[],
      find: (id: string) => Promise<{ userId: string; status?: string } | null>,
      doUpsert: (id: string, r: Rec) => Promise<void>,
      protect?: (existing: { status?: string }) => boolean,
    ) {
      let count = 0;
      for (const r of list) {
        const id = String(r.id);
        const existing = await find(id);
        if (existing && existing.userId !== userId) {
          skipped++;
          continue;
        }
        if (existing && protect && protect(existing)) {
          skipped++;
          continue;
        }
        await doUpsert(id, r);
        count++;
      }
      if (count > 0) restored[key] = count;
    }

    await upsertList(
      "raceEvents",
      data.raceEvents as Rec[],
      (id) => tx.raceEvent.findUnique({ where: { id }, select: { userId: true } }),
      async (id, r) => {
        const payload = {
          userId,
          name: s(r, "name") ?? "Rennen",
          date: dt(r, "date") ?? new Date(),
          type: s(r, "type") ?? "triathlon",
          distance: s(r, "distance"),
          priority: s(r, "priority"),
          notes: s(r, "notes"),
          completed: bool(r, "completed"),
          resultSeconds: n(r, "resultSeconds"),
          resultPlacement: n(r, "resultPlacement"),
          resultNote: s(r, "resultNote"),
        };
        await tx.raceEvent.upsert({ where: { id }, create: { id, ...payload }, update: payload });
      },
    );

    // PlannedWorkouts: completed niemals überschreiben.
    await upsertList(
      "plannedWorkouts",
      data.plannedWorkouts as Rec[],
      (id) =>
        tx.plannedWorkout.findUnique({
          where: { id },
          select: { userId: true, status: true },
        }),
      async (id, r) => {
        const payload = {
          userId,
          date: dt(r, "date") ?? new Date(),
          sport: s(r, "sport") ?? "other",
          title: s(r, "title") ?? "Workout",
          plannedDurationMin: n(r, "plannedDurationMin") ?? 0,
          plannedDistanceM: n(r, "plannedDistanceM"),
          rpe: n(r, "rpe"),
          description: s(r, "description"),
          segmentsJson: (r.segmentsJson as object) ?? [],
          status: s(r, "status") ?? "planned",
          source: s(r, "source") ?? "plan_import",
        };
        await tx.plannedWorkout.upsert({ where: { id }, create: { id, ...payload }, update: payload });
      },
      (existing) => existing.status === "completed",
    );

    // ActualActivities: niemals überschreiben (nur neu anlegen).
    {
      let count = 0;
      for (const r of data.actualActivities as Rec[]) {
        const id = String(r.id);
        const existing = await tx.actualActivity.findUnique({
          where: { id },
          select: { userId: true },
        });
        if (existing) {
          skipped++;
          continue;
        }
        await tx.actualActivity.create({
          data: {
            id,
            userId,
            externalId: s(r, "externalId"),
            source: s(r, "source") ?? "manual",
            date: dt(r, "date") ?? new Date(),
            sport: s(r, "sport") ?? "other",
            durationMin: n(r, "durationMin"),
            distanceKm: n(r, "distanceKm"),
            distanceM: n(r, "distanceM"),
            load: n(r, "load"),
            rpe: n(r, "rpe"),
            avgHr: n(r, "avgHr"),
            notes: s(r, "notes"),
            rawJson: (r.rawJson as object) ?? undefined,
          },
        });
        count++;
      }
      if (count > 0) restored.actualActivities = count;
    }

    await upsertList(
      "gearItems",
      data.gearItems as Rec[],
      (id) => tx.gearItem.findUnique({ where: { id }, select: { userId: true } }),
      async (id, r) => {
        const payload = {
          userId,
          name: s(r, "name") ?? "Gerät",
          type: s(r, "type") ?? "other",
          sport: s(r, "sport"),
          parentId: s(r, "parentId"),
          brand: s(r, "brand"),
          model: s(r, "model"),
          purchaseDate: dt(r, "purchaseDate"),
          retired: bool(r, "retired"),
          autoTrack: bool(r, "autoTrack", true),
          manualKm: n(r, "manualKm") ?? 0,
          manualHours: n(r, "manualHours") ?? 0,
          alertKm: n(r, "alertKm"),
          alertHours: n(r, "alertHours"),
          notes: s(r, "notes"),
        };
        await tx.gearItem.upsert({ where: { id }, create: { id, ...payload }, update: payload });
      },
    );

    await upsertList(
      "trainingGoals",
      data.trainingGoals as Rec[],
      (id) => tx.trainingGoal.findUnique({ where: { id }, select: { userId: true } }),
      async (id, r) => {
        const payload = {
          userId,
          sport: s(r, "sport") ?? "run",
          weeklyTargetMin: n(r, "weeklyTargetMin") ?? 0,
        };
        await tx.trainingGoal.upsert({ where: { id }, create: { id, ...payload }, update: payload });
      },
    );

    await upsertList(
      "bodyMetrics",
      data.bodyMetrics as Rec[],
      (id) => tx.bodyMetric.findUnique({ where: { id }, select: { userId: true } }),
      async (id, r) => {
        const payload = {
          userId,
          date: dt(r, "date") ?? new Date(),
          weightKg: n(r, "weightKg"),
          restingHr: n(r, "restingHr"),
          notes: s(r, "notes"),
        };
        await tx.bodyMetric.upsert({ where: { id }, create: { id, ...payload }, update: payload });
      },
    );

    await upsertList(
      "journalEntries",
      data.journalEntries as Rec[],
      (id) => tx.journalEntry.findUnique({ where: { id }, select: { userId: true } }),
      async (id, r) => {
        const payload = {
          userId,
          date: dt(r, "date") ?? new Date(),
          mood: n(r, "mood"),
          text: s(r, "text") ?? "",
        };
        await tx.journalEntry.upsert({ where: { id }, create: { id, ...payload }, update: payload });
      },
    );

    await upsertList(
      "readinessSnapshots",
      data.readinessSnapshots as Rec[],
      (id) => tx.readinessSnapshot.findUnique({ where: { id }, select: { userId: true } }),
      async (id, r) => {
        const payload = {
          userId,
          date: dt(r, "date") ?? new Date(),
          status: s(r, "status"),
          sleepTrend: s(r, "sleepTrend"),
          hrvTrend: s(r, "hrvTrend"),
          restingHrTrend: s(r, "restingHrTrend"),
          subjectiveFatigue: n(r, "subjectiveFatigue"),
          notes: s(r, "notes"),
        };
        await tx.readinessSnapshot.upsert({ where: { id }, create: { id, ...payload }, update: payload });
      },
    );

    await upsertList(
      "painSnapshots",
      data.painSnapshots as Rec[],
      (id) => tx.painSnapshot.findUnique({ where: { id }, select: { userId: true } }),
      async (id, r) => {
        const payload = {
          userId,
          date: dt(r, "date") ?? new Date(),
          overall: n(r, "overall"),
          knee: n(r, "knee"),
          achilles: n(r, "achilles"),
          calf: n(r, "calf"),
          back: n(r, "back"),
          notes: s(r, "notes"),
        };
        await tx.painSnapshot.upsert({ where: { id }, create: { id, ...payload }, update: payload });
      },
    );
  });

  return { restored, skipped };
}
