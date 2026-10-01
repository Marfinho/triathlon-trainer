import { EXERCISE_DEFINITION_EXAMPLE, EXERCISE_DEFINITION_GUIDE } from "./coachGuide";

/** Platzhalter für den Wunschtext (Server baut den Prompt, der Client setzt ein). */
export const WISH_PLACEHOLDER = "§WUNSCH§";

/**
 * Prompt für „Neue Übung mit KI“: Wunsch des Nutzers, Bauplan, vorhandene IDs,
 * Muskelkatalog und Beispiel. Reiner Text – die Antwort wird wieder geprüft.
 */
export function buildNewExercisePrompt(opts: { wish: string; existingIds: string[] }): string {
  const wish = opts.wish.trim().slice(0, 1000) || "(bitte hier beschreiben)";
  return [
    "Du bist Trainer und erstellst EINE neue Übung für meine Trainings-App im 3D-Format.",
    "Antworte ausschließlich mit EINEM gültigen JSON-Objekt (format \"3d\") – kein Markdown, kein Text davor oder danach.",
    "",
    `MEIN WUNSCH: ${wish}`,
    "",
    EXERCISE_DEFINITION_GUIDE,
    "",
    `VORHANDENE IDs (nicht verwenden): ${opts.existingIds.join(", ")}`,
    "",
    "BEISPIEL (Glute Bridge, gültig – Aufbau übernehmen, Inhalte für die neue Übung neu festlegen):",
    JSON.stringify(EXERCISE_DEFINITION_EXAMPLE),
  ].join("\n");
}
