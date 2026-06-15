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
});

export type CoachSummary = z.infer<typeof coachSummarySchema>;
export type RequestedOutput = z.infer<typeof requestedOutputSchema>;
export type ChatGptInstruction = z.infer<typeof chatGptInstructionSchema>;
