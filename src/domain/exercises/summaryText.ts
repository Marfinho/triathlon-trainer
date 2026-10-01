import { segmentExerciseSchema } from "./schema";
import { getLibraryExercise } from "./library";

/**
 * Lesbarer Übungstext für externe Kalender (Intervals.icu), z. B.
 * „Kraft: Clamshell 2 × 15 je Seite, Dead Bug 3 × 8 je Seite".
 * Rein, ohne DB: eigene Übungen erscheinen mit ihrer ID. null ohne Übungen.
 */
export function exerciseSummaryText(segments: unknown, sport: string): string | null {
  if (!Array.isArray(segments)) return null;
  const parts: string[] = [];
  for (const seg of segments) {
    const parsed = segmentExerciseSchema.safeParse((seg as { exercise?: unknown } | null)?.exercise);
    if (!parsed.success) continue;
    const e = parsed.data;
    const name = getLibraryExercise(e.id)?.title ?? e.id;
    const amount = e.reps != null ? `${e.reps}` : `${e.holdSec} s`;
    let text = `${name} ${e.sets} × ${amount}`;
    if (e.perSide) text += " je Seite";
    if (e.loadKg) text += ` (${e.loadKg} kg)`;
    parts.push(text);
  }
  if (parts.length === 0) return null;
  return `${sport === "mobility" ? "Mobility" : "Kraft"}: ${parts.join(", ")}`;
}
