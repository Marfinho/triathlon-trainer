import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import {
  validateLocalhubPlan,
  type ValidationError,
} from "./validateLocalhubPlan";
import { parseIsoDate, addDays } from "@/domain/training/dates";
import type { ExistingWorkoutRef } from "./validateLocalhubPlan";

/**
 * Importiert einen `localhub_plan` in die Datenbank.
 *
 * Ablauf:
 *  1. Validierung (rein). Bei blockierenden Fehlern: KEINE DB-Änderung.
 *  2. In einer Transaktion:
 *     - TrainingPlanImport anlegen
 *     - offene Workouts (planned/synced) im Zeitraum als `replaced` markieren
 *       (niemals `completed`!)
 *     - neue PlannedWorkouts aus entries anlegen (planImportId gesetzt)
 *     - SyncQueue-Jobs anlegen (create für neue; delete für ersetzte, die bereits
 *       mit Intervals.icu verknüpft waren)
 *  3. Rückgabe: importJobId + Vorschau.
 *
 * `EXPORT_MISMATCH` wird als nicht-blockierende Warnung behandelt.
 */

export interface ImportDeps {
  db?: PrismaClient;
  userId: string;
  triggeredBy?: string;
}

export interface ImportPreviewEntry {
  date: string;
  sport: string;
  title: string;
  plannedDurationMin: number;
  status: string;
}

export interface ImportPreview {
  planName: string | null;
  planStart: string;
  planEnd: string;
  planDays: number;
  createdCount: number;
  replacedCount: number;
  protectedCount: number;
  warnings: ValidationError[];
  entries: ImportPreviewEntry[];
  protectedDates: string[];
}

export interface ImportResult {
  success: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  importJobId?: string;
  preview?: ImportPreview;
}

const BLOCKING_EXCLUDE = new Set(["EXPORT_MISMATCH"]);

function toInt(value: number | null | undefined): number | null {
  return typeof value === "number" ? Math.round(value) : null;
}

export async function importLocalhubPlan(
  raw: unknown,
  deps: ImportDeps,
): Promise<ImportResult> {
  const db = deps.db ?? defaultPrisma;
  const userId = deps.userId;
  const triggeredBy = deps.triggeredBy ?? "import";

  // 1a. Erster Pass (rein, ohne DB) – liefert den Zeitraum, falls strukturell ok.
  const firstPass = validateLocalhubPlan(raw);
  if (!firstPass.valid || !firstPass.meta) {
    return { success: false, errors: firstPass.errors, warnings: [] };
  }

  const { planStart, planEnd } = firstPass.meta;
  const rangeStart = parseIsoDate(planStart);
  const rangeEndExclusive = addDays(parseIsoDate(planEnd), 1);

  // 1b. Vorhandene Workouts im Zeitraum + letzten Export laden.
  const existing = await db.plannedWorkout.findMany({
    where: { userId, date: { gte: rangeStart, lt: rangeEndExclusive } },
    select: { id: true, date: true, status: true, title: true },
  });
  const existingRefs: ExistingWorkoutRef[] = existing.map((w) => ({
    id: w.id,
    date: w.date,
    status: w.status,
    title: w.title,
  }));

  const lastExport = await db.coachSummaryExport.findFirst({
    where: {
      userId,
      requestedFormat: "localhub_plan_json",
      planStart: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { planStart: true, planDays: true },
  });
  const expectedExport =
    lastExport?.planStart && lastExport.planDays
      ? {
          planStart: lastExport.planStart.toISOString().slice(0, 10),
          planDays: lastExport.planDays,
        }
      : null;

  // 1c. Zweiter Pass mit DB-Kontext.
  const result = validateLocalhubPlan(raw, {
    existingWorkouts: existingRefs,
    expectedExport,
  });

  const blockingErrors = result.errors.filter(
    (e) => !BLOCKING_EXCLUDE.has(e.code),
  );
  const warnings = result.errors.filter((e) => BLOCKING_EXCLUDE.has(e.code));

  // Der erste Pass war gültig -> `firstPass.plan` ist garantiert gesetzt. Der
  // zweite Pass liefert nur zusätzliche Warnungen (EXPORT_MISMATCH) sowie die
  // geschützten/ersetzbaren Workouts; er darf den Import nicht blockieren.
  if (blockingErrors.length > 0 || !firstPass.plan) {
    return { success: false, errors: blockingErrors, warnings };
  }

  const plan = firstPass.plan;
  const replaceableIds = result.replaceableWorkouts.map((w) => w.id);
  const protectedDates = result.protectedActivities.map((w) =>
    typeof w.date === "string" ? w.date.slice(0, 10) : w.date.toISOString().slice(0, 10),
  );

  // 2. Transaktion: alles oder nichts.
  const importJobId = await db.$transaction(async (tx) => {
    const importRecord = await tx.trainingPlanImport.create({
      data: {
        userId,
        schemaVersion: plan.schemaVersion,
        type: plan.type,
        planName: plan.planName ?? null,
        generatedAt: plan.generatedAt ? new Date(plan.generatedAt) : null,
        planStart: rangeStart,
        planDays: plan.planDays,
        planEnd: parseIsoDate(planEnd),
        rawJson: raw as object,
        validationStatus: "imported",
        validationErrorsJson: warnings.length > 0 ? (warnings as object) : undefined,
      },
    });

    // Offene Workouts als `replaced` markieren – completed bleibt unangetastet.
    if (replaceableIds.length > 0) {
      await tx.plannedWorkout.updateMany({
        where: {
          userId,
          id: { in: replaceableIds },
          status: { in: ["planned", "synced"] },
        },
        data: { status: "replaced" },
      });

      // Verknüpfte Intervals-Syncs als superseded markieren + Delete-Jobs.
      const syncs = await tx.intervalsWorkoutSync.findMany({
        where: { userId, localWorkoutId: { in: replaceableIds } },
      });
      for (const sync of syncs) {
        await tx.intervalsWorkoutSync.update({
          where: { id: sync.id },
          data: {
            syncStatus: "superseded",
            deletedOrSupersededAt: new Date(),
          },
        });
        if (sync.intervalsEventId) {
          await tx.syncQueue.create({
            data: {
              userId,
              localWorkoutId: sync.localWorkoutId,
              intervalsEventId: sync.intervalsEventId,
              action: "delete",
              status: "pending",
            },
          });
        }
      }

      for (const id of replaceableIds) {
        await tx.syncLog.create({
          data: {
            userId,
            localWorkoutId: id,
            action: "replace",
            type: "sync",
            reason: "plan_import",
            triggeredBy,
            success: true,
          },
        });
      }
    }

    // Neue Workouts anlegen + Create-Sync-Jobs.
    for (const entry of plan.entries) {
      const created = await tx.plannedWorkout.create({
        data: {
          userId,
          date: parseIsoDate(entry.date),
          sport: entry.sport,
          title: entry.title,
          plannedDurationMin: entry.plannedDurationMin,
          plannedDistanceM: toInt(entry.plannedDistanceM),
          rpe: toInt(entry.rpe),
          description: entry.description ?? null,
          segmentsJson: entry.segments as object,
          status: "planned",
          source: "plan_import",
          planImportId: importRecord.id,
        },
      });

      // Ruhetage werden nicht nach Intervals.icu synchronisiert.
      if (entry.sport !== "rest") {
        await tx.syncQueue.create({
          data: {
            userId,
            localWorkoutId: created.id,
            action: "create",
            status: "pending",
          },
        });
      }
    }

    return importRecord.id;
  });

  const preview: ImportPreview = {
    planName: plan.planName ?? null,
    planStart,
    planEnd,
    planDays: plan.planDays,
    createdCount: plan.entries.length,
    replacedCount: replaceableIds.length,
    protectedCount: result.protectedActivities.length,
    warnings,
    entries: plan.entries.map((e) => ({
      date: e.date,
      sport: e.sport,
      title: e.title,
      plannedDurationMin: e.plannedDurationMin,
      status: "planned",
    })),
    protectedDates,
  };

  return { success: true, errors: [], warnings, importJobId, preview };
}
