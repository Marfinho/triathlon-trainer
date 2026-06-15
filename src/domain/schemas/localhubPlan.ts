import { z } from "zod";
import { isoDateSchema, sportSchema } from "./common";
import { segmentSchema } from "./segment";

/**
 * Planimport-Format `localhub_plan` (aktiv).
 *
 * Wird vom externen LLM erzeugt und in LocalHub importiert. Die strukturelle
 * Validierung erfolgt hier (Zod); die fachliche/relationale Validierung
 * (Tagesabdeckung, Ruhetag-Regeln, Segmentsummen, Schwimmdistanzen, geschützte
 * Activities) in `validateLocalhubPlan`.
 */

export const planEntrySchema = z.object({
  date: isoDateSchema,
  sport: sportSchema,
  title: z.string().min(1),
  plannedDurationMin: z.number().int().nonnegative(),
  plannedDistanceM: z.number().nonnegative().nullable().default(null),
  rpe: z.number().nullable().default(null),
  description: z.string().nullable().default(null),
  segments: z.array(segmentSchema).default([]),
});

export type PlanEntry = z.infer<typeof planEntrySchema>;

export const planRationaleSchema = z
  .object({
    summary: z.string().default(""),
    keyAdjustments: z.array(z.string()).default([]),
    riskNotes: z.array(z.string()).default([]),
  })
  .partial()
  .optional();

export const localhubPlanSchema = z.object({
  schemaVersion: z.string(),
  type: z.literal("localhub_plan"),
  planName: z.string().nullable().optional(),
  generatedAt: z.string().nullable().optional(),
  planStart: isoDateSchema,
  planDays: z.number().int().positive(),
  planEnd: isoDateSchema,
  entries: z.array(planEntrySchema),
  planRationale: planRationaleSchema,
  assumptions: z.array(z.string()).optional(),
});

export type LocalhubPlan = z.infer<typeof localhubPlanSchema>;
