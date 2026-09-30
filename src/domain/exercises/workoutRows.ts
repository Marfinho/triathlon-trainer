import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { segmentExerciseSchema } from "./schema";
import { builtinExerciseIds } from "./library";
import { exerciseIdsFromSegments, loadCustomExercises, resolveExercise } from "./resolve";
import { formatExerciseDose } from "./duration";
import { renderThumbSvg } from "./engine";

/** Eine Übungszeile im Kalender-Detail. */
export interface WorkoutExerciseRow {
  id: string;
  title: string;
  /** z. B. „3 × 8 pro Seite" */
  dose: string;
  /** Engine-Ausgabe (null bei unbekannter/ungültiger Übung) */
  thumbSvg: string | null;
  /** true = Detailseite vorhanden */
  linkable: boolean;
}

/**
 * Übungszeilen je Workout (Schlüssel = Workout-ID). Eigene Übungen werden in
 * EINER Abfrage für den Nutzer geladen; Workouts ohne Übungen fehlen.
 */
export async function buildWorkoutExerciseRows(
  userId: string,
  workouts: { id: string; segmentsJson: unknown }[],
  db: Pick<PrismaClient, "customExercise"> = defaultPrisma,
): Promise<Record<string, WorkoutExerciseRow[]>> {
  const allIds = new Set<string>();
  for (const w of workouts) exerciseIdsFromSegments(w.segmentsJson).forEach((id) => allIds.add(id));
  const customIds = [...allIds].filter((id) => !builtinExerciseIds.has(id));
  const custom = await loadCustomExercises(userId, customIds, db);
  const thumbs = new Map<string, string>();

  const out: Record<string, WorkoutExerciseRow[]> = {};
  for (const w of workouts) {
    if (!Array.isArray(w.segmentsJson)) continue;
    const rows: WorkoutExerciseRow[] = [];
    for (const seg of w.segmentsJson) {
      const parsed = segmentExerciseSchema.safeParse((seg as { exercise?: unknown } | null)?.exercise);
      if (!parsed.success) continue;
      const ex = parsed.data;
      const r = resolveExercise(ex.id, { customById: custom });
      let thumb: string | null = null;
      if (r.status === "ok") {
        thumb = thumbs.get(ex.id) ?? renderThumbSvg(r.definition);
        thumbs.set(ex.id, thumb);
      }
      rows.push({
        id: ex.id,
        title: r.status === "ok" ? r.definition.title : ex.id,
        dose: formatExerciseDose(ex),
        thumbSvg: thumb,
        linkable: r.status === "ok",
      });
    }
    if (rows.length > 0) out[w.id] = rows;
  }
  return out;
}
