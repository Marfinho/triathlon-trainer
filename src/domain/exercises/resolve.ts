import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { builtinExerciseIds, getLibraryExercise, libraryExercises } from "./library";
import { parseStoredDefinition } from "./parse";
import { exerciseIdsFromSegments } from "./guided";
import type { AnyExerciseDefinition } from "./any";

export { parseStoredDefinition, exerciseIdsFromSegments };

/**
 * Auflösung von Übungs-IDs. Reihenfolge: eingebaute Bibliothek, dann eigene
 * Übungen (`CustomExercise`) des Nutzers. Eigene Definitionen werden beim
 * Lesen ERNEUT mit Zod geprüft; ungültige werden übersprungen und geloggt –
 * die UI zeigt dann einen Platzhalter statt abzustürzen.
 */

export type ExerciseSource = "builtin" | "custom";

export type ResolvedExercise =
  | { id: string; status: "ok"; source: ExerciseSource; definition: AnyExerciseDefinition }
  | { id: string; status: "invalid"; source: "custom"; definition: null }
  | { id: string; status: "missing"; source: null; definition: null };

type Db = Pick<PrismaClient, "customExercise">;

/**
 * Löst eine ID auf. `customById` = bereits geladene eigene Definitionen des
 * Nutzers (Rohdaten aus der DB), Schlüssel = exerciseId.
 */
export function resolveExercise(
  id: string,
  opts: { customById?: ReadonlyMap<string, unknown> } = {},
): ResolvedExercise {
  const builtin = getLibraryExercise(id);
  if (builtin) return { id, status: "ok", source: "builtin", definition: builtin };
  const raw = opts.customById?.get(id);
  if (raw === undefined) return { id, status: "missing", source: null, definition: null };
  const def = parseStoredDefinition(id, raw);
  return def
    ? { id, status: "ok", source: "custom", definition: def }
    : { id, status: "invalid", source: "custom", definition: null };
}


/** Lädt die eigenen Übungen eines Nutzers (optional nur bestimmte IDs). */
export async function loadCustomExercises(
  userId: string,
  ids?: string[],
  db: Db = defaultPrisma,
): Promise<Map<string, unknown>> {
  if (ids && ids.length === 0) return new Map();
  const rows = await db.customExercise.findMany({
    where: { userId, ...(ids ? { exerciseId: { in: ids } } : {}) },
    select: { exerciseId: true, definitionJson: true },
    orderBy: { exerciseId: "asc" },
  });
  return new Map(rows.map((r) => [r.exerciseId, r.definitionJson as unknown]));
}

/**
 * Löst alle Übungen der Segmente eines Workouts auf. Eigene Übungen werden
 * nur für `userId` geladen (Mandantentrennung).
 */
export async function resolveExercisesForWorkout(
  userId: string,
  segments: unknown,
  db: Db = defaultPrisma,
): Promise<Map<string, ResolvedExercise>> {
  const ids = exerciseIdsFromSegments(segments);
  const customIds = ids.filter((id) => !builtinExerciseIds.has(id));
  const custom = await loadCustomExercises(userId, customIds, db);
  return new Map(ids.map((id) => [id, resolveExercise(id, { customById: custom })]));
}

/** Alle gültigen eigenen Übungen eines Nutzers (für die Bibliothek). */
export async function listValidCustomExercises(
  userId: string,
  db: Db = defaultPrisma,
): Promise<AnyExerciseDefinition[]> {
  const custom = await loadCustomExercises(userId, undefined, db);
  const out: AnyExerciseDefinition[] = [];
  for (const [id, raw] of custom) {
    // Kollidiert eine gespeicherte ID mit der Bibliothek, gewinnt die Bibliothek.
    if (builtinExerciseIds.has(id)) continue;
    const def = parseStoredDefinition(id, raw);
    if (def) out.push(def);
  }
  return out;
}

export interface LibraryItem {
  definition: AnyExerciseDefinition;
  custom: boolean;
}

/** Eingebaute Bibliothek plus gültige eigene Übungen des Nutzers. */
export async function listExercisesForUser(
  userId: string,
  db: Db = defaultPrisma,
): Promise<LibraryItem[]> {
  const custom = await listValidCustomExercises(userId, db);
  return [
    ...libraryExercises.map((definition) => ({ definition, custom: false })),
    ...custom.map((definition) => ({ definition, custom: true })),
  ];
}

/** Eine Übung für die Detailansicht (Bibliothek, sonst eigene des Nutzers). */
export async function findExerciseForUser(
  userId: string,
  id: string,
  db: Db = defaultPrisma,
): Promise<LibraryItem | null> {
  const builtin = getLibraryExercise(id);
  if (builtin) return { definition: builtin, custom: false };
  const custom = await loadCustomExercises(userId, [id], db);
  const resolved = resolveExercise(id, { customById: custom });
  return resolved.status === "ok" ? { definition: resolved.definition, custom: true } : null;
}
