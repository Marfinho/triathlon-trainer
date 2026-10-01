import rawLibrary3d from "./library/exercise-library-3d.json";
import { EXERCISE_3D_GUIDE } from "./body3d/guide";
import { libraryExercises } from "./library";
import type { ExerciseCategory } from "./schema";
import { musclesOf, type AnyExerciseDefinition } from "./any";

/**
 * Bausteine für den Coach-Export: Übungskatalog, Kurzregeln sowie Bauplan
 * und Beispiel für eigene Übungen im 3D-Format.
 * Texte stammen aus docs/coach-prompt-addendum.md.
 */

export interface ExerciseCatalogEntry {
  id: string;
  title: string;
  category: ExerciseCategory;
  /** Muskelbezeichnungen in Klartext */
  muscles: string[];
  dose: string;
  /** true = eigene Übung des Nutzers (sonst eingebaute Bibliothek) */
  custom?: boolean;
}

function toCatalogEntry(def: AnyExerciseDefinition, custom: boolean): ExerciseCatalogEntry {
  const entry: ExerciseCatalogEntry = {
    id: def.id,
    title: def.title,
    category: def.category,
    // ohne Seitenangabe, doppelte zusammengefasst – der Katalog bleibt knapp
    muscles: [...new Set(musclesOf(def).map((m) => m.label.replace(/ \((links|rechts)\)$/, "")))],
    dose: def.dose,
  };
  if (custom) entry.custom = true;
  return entry;
}

/** Katalog: eingebaute Bibliothek, danach die eigenen Übungen des Nutzers. */
export function buildExerciseCatalog(customExercises: AnyExerciseDefinition[] = []): ExerciseCatalogEntry[] {
  const builtinIds = new Set(libraryExercises.map((e) => e.id));
  return [
    ...libraryExercises.map((e) => toCatalogEntry(e, false)),
    ...customExercises.filter((e) => !builtinIds.has(e.id)).map((e) => toCatalogEntry(e, true)),
  ];
}

/** Kurzregeln für Plan-Exporte (training_plan, plan_review). */
export const EXERCISE_RULES: readonly string[] = [
  'Kraft- und Mobility-Einheiten mit sport "strength" bzw. "mobility" planen, nicht als "other".',
  'Für Kraft- und Mobility-Einheiten: Segmente mit `exercise` { id, sets, reps ODER holdSec, restSec, perSide, loadKg, note } und schemaVersion "1.1".',
  "`exercise.id` nur aus `exerciseCatalog` verwenden; keine IDs erfinden.",
  "`durationSec` eines Übungssegments = Gesamtzeit inklusive Pausen; die Segmentsumme muss zu plannedDurationMin passen.",
  ];

/** Regeln für eigene Übungen (immer Teil der Plan-Exporte). */
export const CUSTOM_EXERCISE_RULES: readonly string[] = [
  'Passt keine Katalogübung, definiere eine eigene Übung in `exerciseDefinitions` im 3D-Format (format "3d"). Halte dich exakt an `exerciseDefinitionGuide` und `exerciseDefinitionExample`.',
  "Eigene Übungen enthalten nur Zahlen, Enums und kurze Texte, niemals SVG, HTML oder URLs. Die ID darf nicht im Katalog stehen.",
];

/** Bauplan für eigene Übungen (3D-Format 2.0). */
export const EXERCISE_DEFINITION_GUIDE = EXERCISE_3D_GUIDE;

/** Beispiel einer Übung im 3D-Format (Glute Bridge aus der 3D-Bibliothek). */
export const EXERCISE_DEFINITION_EXAMPLE: unknown = (rawLibrary3d as { id: string }[]).find((e) => e.id === "glute-bridge");
