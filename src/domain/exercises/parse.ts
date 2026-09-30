import { exerciseDefinitionSchema, type ExerciseDefinition } from "./schema";

/**
 * Prüft eine gespeicherte (eigene) Definition erneut mit Zod. Ungültige
 * Definitionen liefern null und werden geloggt – Aufrufer zeigen dann einen
 * Platzhalter. Rein, ohne DB.
 */
export function parseStoredDefinition(exerciseId: string, json: unknown): ExerciseDefinition | null {
  const parsed = exerciseDefinitionSchema.safeParse(json);
  if (!parsed.success || parsed.data.id !== exerciseId) {
    console.warn(
      `[exercises] Eigene Übung "${exerciseId}" ist ungültig und wird übersprungen:`,
      parsed.success ? "ID passt nicht" : parsed.error.issues[0]?.message,
    );
    return null;
  }
  return parsed.data;
}
