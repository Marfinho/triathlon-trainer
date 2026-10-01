import exampleDefinition from "./library/example-custom-exercise.json";
import { builtinExercises } from "./library";
import type { ExerciseCategory, ExerciseDefinition } from "./schema";

/**
 * Bausteine für den Coach-Export: Übungskatalog, Kurzregeln und (nur bei
 * `allowCustomExercises`) Leitfaden und Beispiel für eigene Übungen.
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

function toCatalogEntry(def: ExerciseDefinition, custom: boolean): ExerciseCatalogEntry {
  const entry: ExerciseCatalogEntry = {
    id: def.id,
    title: def.title,
    category: def.category,
    muscles: def.muscles.map((m) => m.label),
    dose: def.dose,
  };
  if (custom) entry.custom = true;
  return entry;
}

/** Katalog: eingebaute Bibliothek, danach die eigenen Übungen des Nutzers. */
export function buildExerciseCatalog(customExercises: ExerciseDefinition[] = []): ExerciseCatalogEntry[] {
  const builtinIds = new Set(builtinExercises.map((e) => e.id));
  return [
    ...builtinExercises.map((e) => toCatalogEntry(e, false)),
    ...customExercises.filter((e) => !builtinIds.has(e.id)).map((e) => toCatalogEntry(e, true)),
  ];
}

/** Kurzregeln für Plan-Exporte (training_plan, plan_review). */
export const EXERCISE_RULES: readonly string[] = [
  'Kraft- und Mobility-Einheiten mit sport "strength" bzw. "mobility" planen, nicht als "other".',
  'Für Kraft- und Mobility-Einheiten: Segmente mit `exercise` { id, sets, reps ODER holdSec, restSec, perSide, loadKg, note } und schemaVersion "1.1".',
  "`exercise.id` nur aus `exerciseCatalog` verwenden; keine IDs erfinden.",
  "`durationSec` eines Übungssegments = Gesamtzeit inklusive Pausen; die Segmentsumme muss zu plannedDurationMin passen.",
  "Passt keine Katalogübung, das Segment ohne `exercise` mit Beschreibung anlegen.",
];

/** Zusätzliche Regeln, wenn eigene Übungen erlaubt sind. */
export const CUSTOM_EXERCISE_RULES: readonly string[] = [
  "Eigene Übungen dürfen in `exerciseDefinitions` definiert werden. Halte dich exakt an `exerciseDefinitionGuide` und `exerciseDefinitionExample`.",
  "Eigene Übungen nur, wenn keine Katalogübung passt. Definitionen enthalten nur Zahlen, Enums und kurze Texte, niemals SVG oder HTML.",
];

/** Leitfaden für eigene Übungen (Freitext in der Coach-Summary). */
export const EXERCISE_DEFINITION_GUIDE = `EIGENE ÜBUNGEN – Aufbau einer Definition (exerciseDefinitions[], schemaVersion "1.1")

Ansicht: Seitenansicht einer Figur, die nach rechts blickt. Zeichenfläche x 0–200, y −20 bis 150.
Boden bei y = 136. Eine Einheit entspricht etwa 1,5 cm.
Körperlängen: Rumpf (hip → neck) 34, Oberschenkel 30, Unterschenkel 30, Oberarm 20, Unterarm 18.
Aufrechte Figur: hip (100,73), neck (100,39), Fußgelenke bei y = 133, Sohlen berühren y = 136.

Felder einer Definition: id (kebab-case), title, subtitle, category ("strength"|"mobility"), why, steps[1–8],
mistakes[0–6], dose, progression, muscles[1–6], start (Pose), end (Pose), fault (Pose oder null),
faultCaption (oder null), frames (genau 4), tempo, tempoText.

Pose:
- hip [x,y]; neck [x,y] (alternativ lean in Grad, 0 = aufrecht); optional head, headOffset, spine (3 Punkte).
- farLimbs und nearLimbs: körperferne bzw. körpernahe Arme und Beine, jeweils mit root "hip" (Bein) oder
  "neck" (Arm). Gliedmaße = entweder ik { end:[x,y], bend:1|-1 } (Zielpunkt Fußgelenk bzw. Hand, das mittlere
  Gelenk wird berechnet) oder points [[Gelenk],[Ende]].
  bend 1: Bei nach unten zeigender Gliedmaße weicht das Gelenk nach rechts (vorn) aus, bei nach rechts zeigender
  nach oben, bei nach oben zeigender nach links, bei nach links zeigender nach unten. bend -1 spiegelt das.
- foot (nur Beine, sonst null): { angle, toeAngle, direction, flip }.
  angle 0 = Fuß flach, positiv = Zehen nach unten. toeAngle null = starrer Fuß; sonst Winkel der Zehen
  (bei Fersenheben liegen die Zehen flach: toeAngle 0). direction 1 = Zehen zeigen nach rechts, −1 nach links.
  flip true = Sohle zeigt nach oben (Spann liegt auf).
- muscles (an Gliedmaßen) und torsoMuscles (am Rumpf): Muskelschlüssel, die in dieser Pose markiert werden.
  Beinschlüssel: quad, ham, vmo, add, calf, sol, ach, tib, pat, glute, hipfl, glmed.
  Rumpfschlüssel: core, back, obl, chest. Jeder verwendete Schlüssel muss in muscles[] der Übung beschrieben sein.
- props: { type:"box", x,y,w,h } (Bank, Stufe, Box) oder { type:"wall", x, w } (Wand).
- annotations: { type:"arrow", from, to, curve? }, { type:"guide", from, to } (Soll-Linie),
  { type:"label", text (max. 40 Zeichen), at, anchor }.
- kettlebell { nearLimb, offset } hängt eine Kettlebell an die Hand der angegebenen nahen Gliedmaße.
- frontView true, wenn die Übung frontal gezeichnet wird (z. B. Seitstütz).

start und end MÜSSEN dieselbe Gliedmaßen-Struktur haben (gleiche Anzahl, gleiche root, jeweils ik oder points),
sonst lässt sich die Bewegung nicht interpolieren.
frames: genau 4 Einträge { t, label } mit t zwischen 0 (start) und 1 (end), z. B. 0, 0.5, 1, 0.5.
tempo: { toEndSec, holdEndSec, toStartSec, holdStartSec } in Sekunden (0,2–60).

Qualitätsprüfung vor der Ausgabe: Stehen die Füße auf dem Boden (Fußgelenk y ≈ 133)? Sind Ober- und Unterschenkel
erreichbar (Abstand hip → Fußgelenk höchstens 60)? Stimmen Start und Ende in der Struktur überein?`;

/** Beispiel einer eigenen Übung (Bird Dog). */
export const EXERCISE_DEFINITION_EXAMPLE: unknown = exampleDefinition;
