import rawLibrary from "./exercise-library.json";
import rawLibrary3d from "./exercise-library-3d.json";
import { exerciseDefinitionSchema, type ExerciseDefinition } from "../schema";
import { exercise3dDefinitionSchema, validateExercise3d, type Exercise3dDefinition } from "../body3d";
import type { AnyExerciseDefinition } from "../any";

/**
 * Eingebaute Übungsbibliothek. Wird beim Modulladen EINMAL gegen das Schema
 * geprüft. Ein Fehler ist ein Build-Fehler (kaputte JSON-Datei im Repo) und
 * kein Laufzeitfall – deshalb eine laute Exception mit ID und Pfad.
 */
function loadLibrary(raw: unknown): ExerciseDefinition[] {
  if (!Array.isArray(raw)) {
    throw new Error("Übungsbibliothek: exercise-library.json muss ein Array sein.");
  }
  const seen = new Set<string>();
  return raw.map((entry, index) => {
    const parsed = exerciseDefinitionSchema.safeParse(entry);
    const id =
      entry && typeof entry === "object" && "id" in entry ? String(entry.id) : `#${index}`;
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(
        `Übungsbibliothek: Übung "${id}" ist ungültig bei ${issue.path.join(".") || "(Wurzel)"}: ${issue.message}`,
      );
    }
    if (seen.has(parsed.data.id)) {
      throw new Error(`Übungsbibliothek: ID "${parsed.data.id}" ist doppelt.`);
    }
    seen.add(parsed.data.id);
    return parsed.data;
  });
}

/**
 * 3D-Bibliothek (Format 2.0): zusätzlich zur Schemaprüfung die fachliche
 * Prüfung (Gelenkbereiche, Kontakte). Fehler sind ebenfalls Build-Fehler.
 */
function loadLibrary3d(raw: unknown): Exercise3dDefinition[] {
  if (!Array.isArray(raw)) {
    throw new Error("Übungsbibliothek: exercise-library-3d.json muss ein Array sein.");
  }
  const seen = new Set<string>();
  return raw.map((entry, index) => {
    const parsed = exercise3dDefinitionSchema.safeParse(entry);
    const id =
      entry && typeof entry === "object" && "id" in entry ? String(entry.id) : `#${index}`;
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(
        `3D-Bibliothek: Übung "${id}" ist ungültig bei ${issue.path.join(".") || "(Wurzel)"}: ${issue.message}`,
      );
    }
    const { errors } = validateExercise3d(parsed.data);
    if (errors.length > 0) {
      throw new Error(`3D-Bibliothek: Übung "${id}" bei ${errors[0].path}: ${errors[0].message}`);
    }
    if (seen.has(parsed.data.id)) {
      throw new Error(`3D-Bibliothek: ID "${parsed.data.id}" ist doppelt.`);
    }
    seen.add(parsed.data.id);
    return parsed.data;
  });
}

/** Klassische 2D-Bibliothek (Format 1.x) – Grundlage der Golden-Tests. */
export const builtinExercises: readonly ExerciseDefinition[] = Object.freeze(
  loadLibrary(rawLibrary),
);

/** 3D-Übungen (Format 2.0). */
export const builtin3dExercises: readonly Exercise3dDefinition[] = Object.freeze(
  loadLibrary3d(rawLibrary3d),
);

const byId = new Map(builtinExercises.map((e) => [e.id, e]));
const byId3d = new Map(builtin3dExercises.map((e) => [e.id, e]));

/**
 * Bibliothek, wie die App sie zeigt: gibt es eine 3D-Fassung, ersetzt sie die
 * 2D-Fassung derselben ID; Reihenfolge wie in der 2D-Bibliothek, neue
 * 3D-Übungen danach.
 */
export const libraryExercises: readonly AnyExerciseDefinition[] = Object.freeze([
  ...builtinExercises.map((e) => byId3d.get(e.id) ?? e),
  ...builtin3dExercises.filter((e) => !byId.has(e.id)),
]);

export const builtinExerciseIds: ReadonlySet<string> = new Set(
  libraryExercises.map((e) => e.id),
);

const libraryById = new Map(libraryExercises.map((e) => [e.id, e]));

/** 2D-Fassung (Format 1.x) einer eingebauten Übung. */
export function getBuiltinExercise(id: string): ExerciseDefinition | null {
  return byId.get(id) ?? null;
}

/** Eingebaute Übung, wie die App sie zeigt (3D bevorzugt). */
export function getLibraryExercise(id: string): AnyExerciseDefinition | null {
  return libraryById.get(id) ?? null;
}

/** Nur für Tests: Validierungslogik mit beliebigen Daten prüfen. */
export const __loadLibraryForTest = loadLibrary;
export const __loadLibrary3dForTest = loadLibrary3d;
