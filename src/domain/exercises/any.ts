import { renderFaultSvg, renderFrameSvg, renderHeroSvg, renderThumbSvg } from "./engine";
import { z } from "zod";
import { exerciseDefinitionSchema, MAX_DEFINITIONS_PER_PLAN, type ExerciseDefinition } from "./schema";
import {
  cycleDuration,
  exercise3dDefinitionSchema,
  muscleLabel,
  renderFault3dSvg,
  renderFrame3dSvg,
  renderHero3dSvg,
  renderThumb3dSvg,
  type Exercise3dDefinition,
} from "./body3d";

/**
 * Gemeinsame Sicht auf beide Übungsformate: 1.x (2D-Bildpunkte) und 2.0
 * („3d“, Gelenkwinkel). Die UI fragt nur diese Funktionen; welches Format
 * dahintersteckt, entscheidet `isExercise3d`.
 */
export type AnyExerciseDefinition = ExerciseDefinition | Exercise3dDefinition;

export function isExercise3d(def: AnyExerciseDefinition): def is Exercise3dDefinition {
  return (def as { format?: unknown }).format === "3d";
}

/** Prüft eine Definition im passenden Format (`format: "3d"` → 2.0, sonst 1.x). */
export function parseAnyDefinition(
  json: unknown,
): { success: true; data: AnyExerciseDefinition } | { success: false; issues: { path: (string | number)[]; message: string }[] } {
  const is3d = !!json && typeof json === "object" && (json as { format?: unknown }).format === "3d";
  const parsed = is3d ? exercise3dDefinitionSchema.safeParse(json) : exerciseDefinitionSchema.safeParse(json);
  if (parsed.success) return { success: true, data: parsed.data };
  return { success: false, issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) };
}

export type MuscleRoleView = "work" | "support" | "stretch" | "stabilize";

export interface MuscleView {
  key: string;
  label: string;
  note: string;
  role: MuscleRoleView;
}

export const MUSCLE_ROLE_LABEL: Record<MuscleRoleView, string> = {
  work: "Hauptarbeit",
  support: "unterstützend",
  stretch: "wird gedehnt",
  stabilize: "stabilisiert",
};

/** Zielmuskeln in Anzeige-Reihenfolge (= Nummern im Muskelbild). */
export function musclesOf(def: AnyExerciseDefinition): MuscleView[] {
  if (isExercise3d(def))
    return def.muscles.map((m) => ({ key: m.id, label: muscleLabel(m.id), note: m.note, role: m.role }));
  return def.muscles.map((m) => ({
    key: m.key,
    label: m.label,
    note: m.note,
    role: m.kind === "stretch" ? "stretch" : m.level === 1 ? "work" : "support",
  }));
}

/** Dauer einer Wiederholung (s) – Grundlage der Zeitschätzung. */
export type TimedDefinition = Pick<ExerciseDefinition, "tempo"> | Pick<Exercise3dDefinition, "format" | "keyframes">;

export function repDurationSec(def: TimedDefinition): number {
  if ("keyframes" in def) return cycleDuration(def);
  const t = def.tempo;
  return t.toEndSec + t.holdEndSec + t.toStartSec + t.holdStartSec;
}

export function frameLabels(def: AnyExerciseDefinition): string[] {
  return def.frames.map((f) => f.label);
}

export function renderHeroAny(def: AnyExerciseDefinition): string {
  return isExercise3d(def) ? renderHero3dSvg(def) : renderHeroSvg(def);
}

export function renderThumbAny(def: AnyExerciseDefinition): string {
  return isExercise3d(def) ? renderThumb3dSvg(def) : renderThumbSvg(def);
}

export function renderFrameAny(def: AnyExerciseDefinition, index: number): string {
  return isExercise3d(def) ? renderFrame3dSvg(def, index) : renderFrameSvg(def, index);
}

export function renderFaultAny(def: AnyExerciseDefinition): { svg: string; caption: string } | null {
  if (isExercise3d(def)) {
    const svg = renderFault3dSvg(def);
    return svg && def.fault ? { svg, caption: def.fault.caption } : null;
  }
  const svg = renderFaultSvg(def);
  return svg && def.faultCaption ? { svg, caption: def.faultCaption } : null;
}

/**
 * Schema für eine Definition in beiden Formaten. Bewusst kein `z.union`:
 * so kommen die Fehlermeldungen des passenden Formats an (statt „Invalid
 * input“), was KI-Korrekturschleifen deutlich verkürzt.
 */
export const anyExerciseDefinitionSchema = z.unknown().transform((value, ctx): AnyExerciseDefinition => {
  const parsed = parseAnyDefinition(value);
  if (parsed.success) return parsed.data;
  for (const issue of parsed.issues) ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
  return z.NEVER;
});

export const anyExerciseDefinitionsSchema = z.array(anyExerciseDefinitionSchema).max(MAX_DEFINITIONS_PER_PLAN);
