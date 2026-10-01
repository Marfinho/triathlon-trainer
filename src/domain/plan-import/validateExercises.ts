import type { LocalhubPlan } from "@/domain/schemas";
import { builtinExerciseIds, getLibraryExercise } from "@/domain/exercises/library";
import { isExercise3d, type AnyExerciseDefinition } from "@/domain/exercises/any";
import { validateExercise3d } from "@/domain/exercises/body3d";
import { estimateExerciseDurationSec } from "@/domain/exercises/duration";
import { parseStoredDefinition } from "@/domain/exercises/parse";
import {
  MAX_CUSTOM_EXERCISES_PER_USER,
  MAX_DEFINITIONS_BYTES,
} from "@/domain/exercises/schema";

/**
 * Fachliche Prüfung der Übungen eines `localhub_plan` (rein, ohne DB).
 *
 * Blockierend: EXERCISE_UNKNOWN, EXERCISE_ID_COLLISION, EXERCISE_ID_DUPLICATE,
 * EXERCISE_DEFINITIONS_TOO_LARGE, EXERCISE_DEFINITIONS_NEED_1_1,
 * CUSTOM_EXERCISE_LIMIT, EXERCISE_POSE_INVALID (3D-Format: Gelenkbereich,
 * Kontakte, Bewegung).
 * Warnungen: EXERCISE_DEFINITION_UNUSED, EXERCISE_DURATION_IMPLAUSIBLE,
 * EXERCISE_DEFINITION_UPDATED, EXERCISE_POSE_WARNING.
 */

export interface ExerciseIssue {
  code: string;
  message: string;
  path?: string;
}

/** Bereits gespeicherte eigene Übung des Nutzers (für Import und Vorschau). */
export interface ExistingCustomExerciseRef {
  exerciseId: string;
  definitionJson: unknown;
}

/** Abweichung der geschätzten Übungsdauer, ab der gewarnt wird (50 %). */
export const EXERCISE_DURATION_TOLERANCE_RATIO = 0.5;

/** Serialisierung mit sortierten Schlüsseln – für inhaltliche Gleichheit. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function definitionsEqual(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function validateExerciseReferences(
  plan: LocalhubPlan,
  existingCustom: ExistingCustomExerciseRef[] = [],
): { errors: ExerciseIssue[]; warnings: ExerciseIssue[] } {
  const errors: ExerciseIssue[] = [];
  const warnings: ExerciseIssue[] = [];
  const defs = plan.exerciseDefinitions ?? [];

  if (defs.length > 0 && plan.schemaVersion !== "1.1") {
    errors.push({
      code: "EXERCISE_DEFINITIONS_NEED_1_1",
      message: `exerciseDefinitions erfordern schemaVersion "1.1" (ist "${plan.schemaVersion}").`,
      path: "schemaVersion",
    });
  }

  if (byteLength(JSON.stringify(defs)) > MAX_DEFINITIONS_BYTES) {
    errors.push({
      code: "EXERCISE_DEFINITIONS_TOO_LARGE",
      message: `exerciseDefinitions überschreiten ${MAX_DEFINITIONS_BYTES / 1000} KB.`,
      path: "exerciseDefinitions",
    });
  }

  const planDefs = new Map<string, AnyExerciseDefinition>();
  defs.forEach((d, i) => {
    if (builtinExerciseIds.has(d.id)) {
      errors.push({
        code: "EXERCISE_ID_COLLISION",
        message: `Die ID "${d.id}" gehört zu einer eingebauten Übung und darf nicht neu definiert werden.`,
        path: `exerciseDefinitions[${i}].id`,
      });
    }
    if (planDefs.has(d.id)) {
      errors.push({
        code: "EXERCISE_ID_DUPLICATE",
        message: `Die ID "${d.id}" ist in exerciseDefinitions doppelt.`,
        path: `exerciseDefinitions[${i}].id`,
      });
    }
    planDefs.set(d.id, d);
    // 3D-Format: fachliche Prüfung der Posen (Gelenkbereiche, Kontakte …)
    if (isExercise3d(d)) {
      const check = validateExercise3d(d);
      for (const e of check.errors)
        errors.push({ code: e.code, message: `Übung "${d.id}": ${e.message}`, path: `exerciseDefinitions[${i}].${e.path}` });
      for (const w of check.warnings)
        warnings.push({ code: w.code, message: `Übung "${d.id}": ${w.message}`, path: `exerciseDefinitions[${i}].${w.path}` });
    }
  });

  const existingById = new Map(existingCustom.map((c) => [c.exerciseId, c.definitionJson]));

  // Nutzer-Limit: gespeicherte + neue eigene Übungen.
  const newIds = [...planDefs.keys()].filter(
    (id) => !existingById.has(id) && !builtinExerciseIds.has(id),
  );
  if (existingById.size + newIds.length > MAX_CUSTOM_EXERCISES_PER_USER) {
    errors.push({
      code: "CUSTOM_EXERCISE_LIMIT",
      message: `Höchstens ${MAX_CUSTOM_EXERCISES_PER_USER} eigene Übungen pro Nutzer (vorhanden: ${existingById.size}, neu: ${newIds.length}).`,
      path: "exerciseDefinitions",
    });
  }

  // Geänderte Definitionen werden beim Import überschrieben – Hinweis vorab.
  for (const [id, def] of planDefs) {
    const stored = existingById.get(id);
    if (stored !== undefined && !definitionsEqual(stored, def)) {
      warnings.push({
        code: "EXERCISE_DEFINITION_UPDATED",
        message: `Die eigene Übung "${id}" existiert bereits und wird mit der neuen Definition überschrieben.`,
        path: "exerciseDefinitions",
      });
    }
  }

  const definitionFor = (id: string): AnyExerciseDefinition | null => {
    const builtin = getLibraryExercise(id);
    if (builtin) return builtin;
    const fromPlan = planDefs.get(id);
    if (fromPlan) return fromPlan;
    const stored = existingById.get(id);
    return stored !== undefined ? parseStoredDefinition(id, stored) : null;
  };

  const validIds = [...builtinExerciseIds].sort().join(", ");
  const used = new Set<string>();
  plan.entries.forEach((entry, ei) =>
    entry.segments.forEach((seg, si) => {
      const ex = seg.exercise;
      if (!ex) return;
      used.add(ex.id);
      const path = `entries[${ei}].segments[${si}].exercise`;
      const known = builtinExerciseIds.has(ex.id) || planDefs.has(ex.id) || existingById.has(ex.id);
      if (!known) {
        errors.push({
          code: "EXERCISE_UNKNOWN",
          message: `Unbekannte Übung "${ex.id}" (${entry.date}). Gültige IDs: ${validIds}. Eigene Übungen müssen in exerciseDefinitions stehen.`,
          path: `${path}.id`,
        });
        return;
      }
      const def = definitionFor(ex.id);
      if (def && typeof seg.durationSec === "number" && seg.durationSec > 0) {
        const est = estimateExerciseDurationSec(ex, def);
        if (Math.abs(est - seg.durationSec) > seg.durationSec * EXERCISE_DURATION_TOLERANCE_RATIO) {
          warnings.push({
            code: "EXERCISE_DURATION_IMPLAUSIBLE",
            message: `Übung "${ex.id}" (${entry.date}): geschätzte Dauer ca. ${Math.round(est / 60)} min passt nicht zu durationSec ${seg.durationSec} s (${Math.round(seg.durationSec / 60)} min).`,
            path: `${path}`,
          });
        }
      }
    }),
  );

  for (const id of planDefs.keys()) {
    if (!used.has(id)) {
      warnings.push({
        code: "EXERCISE_DEFINITION_UNUSED",
        message: `Die Definition "${id}" wird im Plan nicht verwendet (sie wird trotzdem gespeichert).`,
        path: "exerciseDefinitions",
      });
    }
  }

  return { errors, warnings };
}

/** Übungs-IDs, die ein Plan verwendet (Reihenfolge des ersten Auftretens). */
export function usedExerciseIds(plan: LocalhubPlan): string[] {
  const ids: string[] = [];
  for (const entry of plan.entries)
    for (const seg of entry.segments)
      if (seg.exercise && !ids.includes(seg.exercise.id)) ids.push(seg.exercise.id);
  return ids;
}
