import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { builtinExerciseIds } from "./library";
import { isExercise3d, parseAnyDefinition, type AnyExerciseDefinition } from "./any";
import { validateExercise3d } from "./body3d";
import { MAX_CUSTOM_EXERCISES_PER_USER } from "./schema";

/**
 * Einzelne neue Übung (z. B. von einer KI erzeugt): prüfen und – erst nach
 * ausdrücklicher Freigabe durch den Nutzer – als eigene Übung speichern.
 */

export interface SingleExerciseIssue {
  code: string;
  message: string;
  path?: string;
}

/** Größenlimit einer einzelnen Definition (Serialisierung in Bytes). */
export const MAX_SINGLE_DEFINITION_BYTES = 40_000;

export function checkSingleExercise(raw: unknown): {
  definition: AnyExerciseDefinition | null;
  errors: SingleExerciseIssue[];
  warnings: SingleExerciseIssue[];
} {
  const errors: SingleExerciseIssue[] = [];
  const warnings: SingleExerciseIssue[] = [];
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return { definition: null, errors: [{ code: "INVALID_JSON", message: "Die Antwort ist kein gültiges JSON." }], warnings };
    }
  }
  // Ganzer Plan statt einzelner Übung eingefügt? Dann die erste Definition nehmen.
  if (value && typeof value === "object" && Array.isArray((value as { exerciseDefinitions?: unknown }).exerciseDefinitions)) {
    const defs = (value as { exerciseDefinitions: unknown[] }).exerciseDefinitions;
    if (defs.length !== 1)
      return {
        definition: null,
        errors: [{ code: "EXERCISE_SINGLE_EXPECTED", message: "Bitte genau eine Übung einfügen (ein Objekt mit format \"3d\")." }],
        warnings,
      };
    value = defs[0];
  }
  if (new TextEncoder().encode(JSON.stringify(value) ?? "").length > MAX_SINGLE_DEFINITION_BYTES)
    return {
      definition: null,
      errors: [{ code: "EXERCISE_DEFINITIONS_TOO_LARGE", message: `Die Übung ist größer als ${MAX_SINGLE_DEFINITION_BYTES / 1000} KB.` }],
      warnings,
    };

  const parsed = parseAnyDefinition(value);
  if (!parsed.success) {
    for (const i of parsed.issues.slice(0, 12))
      errors.push({ code: "EXERCISE_SCHEMA", message: i.message, path: i.path.join(".") || "(Wurzel)" });
    return { definition: null, errors, warnings };
  }
  const def = parsed.data;
  if (builtinExerciseIds.has(def.id))
    errors.push({
      code: "EXERCISE_ID_COLLISION",
      message: `Die ID "${def.id}" gehört zu einer eingebauten Übung. Bitte eine eigene ID wählen.`,
      path: "id",
    });
  if (isExercise3d(def)) {
    const v = validateExercise3d(def);
    errors.push(...v.errors);
    warnings.push(...v.warnings);
  } else {
    warnings.push({
      code: "EXERCISE_FORMAT_2D",
      message: "Übung im alten 2D-Format. Sie funktioniert, für den 3D-Körper bitte format \"3d\" verwenden.",
    });
  }
  return { definition: def, errors, warnings };
}

/**
 * Speichert eine geprüfte Übung für `userId` (neu oder Überschreiben der
 * eigenen gleichnamigen). Prüft erneut – der Client ist nicht vertrauenswürdig.
 */
export async function saveSingleExercise(
  userId: string,
  raw: unknown,
  db: Pick<PrismaClient, "customExercise"> = defaultPrisma,
): Promise<
  | { ok: true; id: string; change: "created" | "updated"; warnings: SingleExerciseIssue[] }
  | { ok: false; errors: SingleExerciseIssue[] }
> {
  const check = checkSingleExercise(raw);
  if (!check.definition || check.errors.length > 0)
    return { ok: false, errors: check.errors.length ? check.errors : [{ code: "EXERCISE_SCHEMA", message: "Ungültige Übung." }] };
  const def = check.definition;
  const existing = await db.customExercise.findUnique({
    where: { userId_exerciseId: { userId, exerciseId: def.id } },
    select: { id: true },
  });
  if (!existing) {
    const count = await db.customExercise.count({ where: { userId } });
    if (count >= MAX_CUSTOM_EXERCISES_PER_USER)
      return {
        ok: false,
        errors: [{ code: "CUSTOM_EXERCISE_LIMIT", message: `Höchstens ${MAX_CUSTOM_EXERCISES_PER_USER} eigene Übungen pro Nutzer.` }],
      };
  }
  await db.customExercise.upsert({
    where: { userId_exerciseId: { userId, exerciseId: def.id } },
    create: { userId, exerciseId: def.id, definitionJson: def as object },
    update: { definitionJson: def as object },
  });
  return { ok: true, id: def.id, change: existing ? "updated" : "created", warnings: check.warnings };
}
