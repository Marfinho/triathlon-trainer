import { parseAnyDefinition, type AnyExerciseDefinition } from "./any";

/**
 * Prüft eine gespeicherte (eigene) Definition erneut mit Zod – Format 1.x
 * oder 2.0 („3d“). Ungültige Definitionen liefern null und werden geloggt –
 * Aufrufer zeigen dann einen Platzhalter. Rein, ohne DB.
 */
export function parseStoredDefinition(exerciseId: string, json: unknown): AnyExerciseDefinition | null {
  const parsed = parseAnyDefinition(json);
  if (!parsed.success || parsed.data.id !== exerciseId) {
    console.warn(
      `[exercises] Eigene Übung "${exerciseId}" ist ungültig und wird übersprungen:`,
      parsed.success ? "ID passt nicht" : parsed.issues[0]?.message,
    );
    return null;
  }
  return parsed.data;
}
