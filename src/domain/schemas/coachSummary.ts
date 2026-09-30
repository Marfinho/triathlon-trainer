import { z } from "zod";

/**
 * CoachSummary-Export-Format `coach_summary` (aktiv).
 *
 * Wird von LocalHub erzeugt, vom Nutzer in ein externes LLM kopiert und dort als
 * Eingabe für die Plan-Erstellung verwendet. LocalHub erzeugt dieses Format
 * (siehe `buildCoachSummary`); validiert wird hauptsächlich der erzeugte Output.
 */

export const EXPORT_PURPOSES = [
  "training_plan",
  "plan_review",
  "week_analysis",
  "recovery_check",
  "pain_check",
  "strategy_question",
  "debug",
] as const;
export type ExportPurpose = (typeof EXPORT_PURPOSES)[number];

export const SUMMARY_MODULES = [
  "athlete_profile",
  "season_context",
  "planning_constraints",
  "recent_training_summary",
  "recent_activities",
  "current_planned_workouts",
  "readiness",
  "pain_status",
  "sync_state",
  "coach_notes",
] as const;
export type SummaryModule = (typeof SUMMARY_MODULES)[number];

export const requestedOutputSchema = z.object({
  format: z.literal("localhub_plan_json"),
  planStart: z.string(),
  planDays: z.number().int().positive(),
  language: z.string().default("de"),
  timezone: z.string().default("Europe/Berlin"),
});

export const chatGptInstructionSchema = z.object({
  role: z.string(),
  outputFormat: z.string(),
  rules: z.array(z.string()),
});

/** Eintrag im Übungskatalog der Coach-Summary. */
export const exerciseCatalogEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(["strength", "mobility"]),
  muscles: z.array(z.string()),
  dose: z.string(),
  /** true = eigene Übung des Nutzers */
  custom: z.boolean().optional(),
});

/** Export-Zwecke, bei denen der Übungskatalog mitgeliefert wird. */
export const EXERCISE_CATALOG_PURPOSES: readonly ExportPurpose[] = ["training_plan", "plan_review"];

export const coachSummarySchema = z.object({
  schemaVersion: z.string(),
  type: z.literal("coach_summary"),
  generatedAt: z.string(),
  athleteId: z.string().nullable(),
  exportPurpose: z.enum(EXPORT_PURPOSES),
  requestedOutput: requestedOutputSchema,
  includedModules: z.array(z.enum(SUMMARY_MODULES)),
  modules: z.record(z.string(), z.unknown()),
  chatGptInstruction: chatGptInstructionSchema,
  /** Übungen, die ein Plan per `exercise.id` referenzieren darf (nur Plan-Exporte). */
  exerciseCatalog: z.array(exerciseCatalogEntrySchema).optional(),
  /** true = der Plan darf eigene Übungen in `exerciseDefinitions` mitliefern. */
  allowCustomExercises: z.boolean().optional(),
  /** Leitfaden für eigene Übungen (nur bei allowCustomExercises). */
  exerciseDefinitionGuide: z.string().optional(),
  /** Beispiel einer eigenen Übung (nur bei allowCustomExercises). */
  exerciseDefinitionExample: z.unknown().optional(),
});

export type CoachSummary = z.infer<typeof coachSummarySchema>;
export type RequestedOutput = z.infer<typeof requestedOutputSchema>;
export type ChatGptInstruction = z.infer<typeof chatGptInstructionSchema>;
