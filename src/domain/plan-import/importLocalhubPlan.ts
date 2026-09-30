import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import {
  validateLocalhubPlan,
  type ValidationError,
} from "./validateLocalhubPlan";
import { parseIsoDate, addDays } from "@/domain/training/dates";
import type { ExistingWorkoutRef } from "./validateLocalhubPlan";
import { definitionsEqual, type ExistingCustomExerciseRef } from "./validateExercises";
import { summarizePlanExercises, type PlanExerciseSummary } from "./buildPlanPreview";
import { MAX_CUSTOM_EXERCISES_PER_USER } from "@/domain/exercises/schema";

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
  /** Verwendete Übungen und eigene Definitionen des Plans. */
  exercises: PlanExerciseSummary;
  /** Was mit den eigenen Übungen passiert ist. */
  exerciseChanges: ExerciseChange[];
}

export interface ExerciseChange {
  id: string;
  change: "created" | "updated" | "unchanged";
}

class CustomExerciseLimitError extends Error {
  constructor(public readonly total: number) {
    super("CUSTOM_EXERCISE_LIMIT");
  }
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

  // 1a. Eigene Übungen des Nutzers (nur IDs + Definition; für ID-Auflösung,
  //     Nutzer-Limit und Änderungs-Hinweis).
  const existingCustomExercises: ExistingCustomExerciseRef[] = (
    await db.customExercise.findMany({
      where: { userId },
      select: { exerciseId: true, definitionJson: true },
    })
  ).map((c) => ({ exerciseId: c.exerciseId, definitionJson: c.definitionJson as unknown }));

  // 1b. Erster Pass (ohne Workout-Kontext) – liefert den Zeitraum, falls strukturell ok.
  const firstPass = validateLocalhubPlan(raw, { existingCustomExercises });
  if (!firstPass.valid || !firstPass.meta) {
    return { success: false, errors: firstPass.errors, warnings: firstPass.warnings };
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
    existingCustomExercises,
  });

  const blockingErrors = result.errors.filter(
    (e) => !BLOCKING_EXCLUDE.has(e.code),
  );
  // EXERCISE_DEFINITION_UPDATED wird verbindlich in der Transaktion ermittelt.
  const warnings = [
    ...result.errors.filter((e) => BLOCKING_EXCLUDE.has(e.code)),
    ...result.warnings.filter((w) => w.code !== "EXERCISE_DEFINITION_UPDATED"),
  ];

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
  const exerciseChanges: ExerciseChange[] = [];
  const txResult = await db.$transaction(async (tx) => {
    // Eigene Übungen speichern: neu anlegen, geänderte überschreiben,
    // identische unverändert lassen (No-op).
    for (const def of plan.exerciseDefinitions ?? []) {
      const existingDef = await tx.customExercise.findUnique({
        where: { userId_exerciseId: { userId, exerciseId: def.id } },
        select: { definitionJson: true },
      });
      if (existingDef && definitionsEqual(existingDef.definitionJson, def)) {
        exerciseChanges.push({ id: def.id, change: "unchanged" });
        continue;
      }
      await tx.customExercise.upsert({
        where: { userId_exerciseId: { userId, exerciseId: def.id } },
        create: { userId, exerciseId: def.id, definitionJson: def as object },
        update: { definitionJson: def as object },
      });
      exerciseChanges.push({ id: def.id, change: existingDef ? "updated" : "created" });
    }
    if (exerciseChanges.some((c) => c.change === "created")) {
      const total = await tx.customExercise.count({ where: { userId } });
      if (total > MAX_CUSTOM_EXERCISES_PER_USER) throw new CustomExerciseLimitError(total);
    }

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
  }).catch((e: unknown) => {
    // Nutzer-Limit überschritten: Transaktion ist zurückgerollt.
    if (e instanceof CustomExerciseLimitError) return e;
    throw e;
  });

  if (txResult instanceof CustomExerciseLimitError) {
    return {
      success: false,
      errors: [
        {
          code: "CUSTOM_EXERCISE_LIMIT",
          message: `Höchstens ${MAX_CUSTOM_EXERCISES_PER_USER} eigene Übungen pro Nutzer (wären ${txResult.total}).`,
          path: "exerciseDefinitions",
        },
      ],
      warnings,
    };
  }
  const importJobId = txResult;

  for (const c of exerciseChanges) {
    if (c.change === "updated") {
      warnings.push({
        code: "EXERCISE_DEFINITION_UPDATED",
        message: `Die eigene Übung "${c.id}" wurde mit der neuen Definition überschrieben.`,
        path: "exerciseDefinitions",
      });
    }
  }

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
    exercises: summarizePlanExercises(plan),
    exerciseChanges,
  };

  return { success: true, errors: [], warnings, importJobId, preview };
}
