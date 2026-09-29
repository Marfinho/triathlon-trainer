import rawLibrary from "./exercise-library.json";
import { exerciseDefinitionSchema, type ExerciseDefinition } from "../schema";

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

export const builtinExercises: readonly ExerciseDefinition[] = Object.freeze(
  loadLibrary(rawLibrary),
);

export const builtinExerciseIds: ReadonlySet<string> = new Set(
  builtinExercises.map((e) => e.id),
);

const byId = new Map(builtinExercises.map((e) => [e.id, e]));

export function getBuiltinExercise(id: string): ExerciseDefinition | null {
  return byId.get(id) ?? null;
}

/** Nur für Tests: Validierungslogik mit beliebigen Daten prüfen. */
export const __loadLibraryForTest = loadLibrary;
