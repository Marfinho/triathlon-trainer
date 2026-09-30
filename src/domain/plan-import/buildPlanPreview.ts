import type { LocalhubPlan, PlanEntry } from "@/domain/schemas";
import type { ExistingWorkoutRef } from "./validateLocalhubPlan";
import { formatIsoDate } from "@/domain/training/dates";
import { builtinExerciseIds } from "@/domain/exercises/library";
import {
  exerciseDefinitionSchema,
  MAX_DEFINITIONS_PER_PLAN,
  type ExerciseDefinition,
} from "@/domain/exercises/schema";

/**
 * Tag-für-Tag-Diff zwischen einem `localhub_plan` und den bereits in der DB
 * vorhandenen geplanten Workouts – Grundlage für eine Vorschau/Diff-UI vor
 * dem eigentlichen Import.
 */

export type PlanPreviewAction = "create" | "replace" | "protected" | "rest";

export interface PlanPreviewDay {
  date: string;
  entry: PlanEntry;
  existing: ExistingWorkoutRef | null;
  action: PlanPreviewAction;
}

/** Übungen eines Plans für die Vorschau. */
export interface PlanExerciseSummary {
  /** Verwendete Übungs-IDs (Reihenfolge des ersten Auftretens). */
  used: string[];
  /** Anzahl der Segmente mit Übung. */
  segmentCount: number;
  /** Eigene Definitionen aus `exerciseDefinitions`. */
  custom: { id: string; title: string; valid: boolean }[];
}

/**
 * Zusammenfassung der Übungen eines (strukturell gültigen) Plans. `valid` ist
 * false bei ID-Kollision mit der Bibliothek oder doppelter ID.
 */
export function summarizePlanExercises(plan: LocalhubPlan): PlanExerciseSummary {
  const used: string[] = [];
  let segmentCount = 0;
  for (const entry of plan.entries) {
    for (const seg of entry.segments) {
      if (!seg.exercise) continue;
      segmentCount++;
      if (!used.includes(seg.exercise.id)) used.push(seg.exercise.id);
    }
  }
  const seen = new Set<string>();
  const custom = (plan.exerciseDefinitions ?? []).map((d) => {
    const valid = !builtinExerciseIds.has(d.id) && !seen.has(d.id);
    seen.add(d.id);
    return { id: d.id, title: d.title, valid };
  });
  return { used, segmentCount, custom };
}

export interface RawExerciseDefinitionCheck {
  index: number;
  id: string | null;
  title: string | null;
  valid: boolean;
  /** Erste Schemaverletzung in Klartext (nur wenn ungültig). */
  error: string | null;
  definition: ExerciseDefinition | null;
}

/**
 * Prüft jede eigene Definition EINZELN gegen das Schema – auch wenn der Plan
 * insgesamt ungültig ist. So kann die Import-Vorschau pro Übung „gültig" oder
 * „ungültig" samt Grund anzeigen.
 */
export function inspectRawExerciseDefinitions(raw: unknown): RawExerciseDefinitionCheck[] {
  const defs =
    raw && typeof raw === "object" ? (raw as { exerciseDefinitions?: unknown }).exerciseDefinitions : null;
  if (!Array.isArray(defs)) return [];
  return defs.slice(0, MAX_DEFINITIONS_PER_PLAN * 2).map((d, index) => {
    const obj = d && typeof d === "object" ? (d as Record<string, unknown>) : {};
    const id = typeof obj.id === "string" ? obj.id.slice(0, 60) : null;
    const title = typeof obj.title === "string" ? obj.title.slice(0, 80) : null;
    const parsed = exerciseDefinitionSchema.safeParse(d);
    if (parsed.success) {
      const collision = builtinExerciseIds.has(parsed.data.id);
      return {
        index,
        id,
        title,
        valid: !collision,
        error: collision ? "ID gehört zu einer eingebauten Übung (EXERCISE_ID_COLLISION)." : null,
        definition: parsed.data,
      };
    }
    const issue = parsed.error.issues[0];
    return {
      index,
      id,
      title,
      valid: false,
      error: `${issue.path.join(".") || "(Wurzel)"}: ${issue.message}`,
      definition: null,
    };
  });
}

function toIsoDate(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : formatIsoDate(value);
}

export function buildPlanPreview(
  plan: LocalhubPlan,
  existingWorkouts: ExistingWorkoutRef[],
): PlanPreviewDay[] {
  const existingByDate = new Map<string, ExistingWorkoutRef>();
  for (const w of existingWorkouts) {
    existingByDate.set(toIsoDate(w.date), w);
  }

  return plan.entries
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((entry) => {
      const existing = existingByDate.get(entry.date) ?? null;
      let action: PlanPreviewAction;
      if (entry.sport === "rest") {
        action = "rest";
      } else if (existing?.status === "completed") {
        action = "protected";
      } else if (existing) {
        action = "replace";
      } else {
        action = "create";
      }
      return { date: entry.date, entry, existing, action };
    });
}
