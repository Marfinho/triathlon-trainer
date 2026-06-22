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
  title: z.string().min(1).max(200),
  plannedDurationMin: z.number().int().nonnegative().max(1440),
  plannedDistanceM: z.number().nonnegative().max(1_000_000).nullable().default(null),
  rpe: z.number().nullable().default(null),
  description: z.string().max(4000).nullable().default(null),
  segments: z.array(segmentSchema).max(200).default([]),
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
  planName: z.string().max(200).nullable().optional(),
  generatedAt: z.string().nullable().optional(),
  planStart: isoDateSchema,
  planDays: z.number().int().positive().max(400),
  planEnd: isoDateSchema,
  entries: z.array(planEntrySchema).max(400),
  planRationale: planRationaleSchema,
  assumptions: z.array(z.string().max(1000)).max(100).optional(),
});

export type LocalhubPlan = z.infer<typeof localhubPlanSchema>;
