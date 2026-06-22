import { z } from "zod";

/**
 * Segmentformat (camelCase, aktiv).
 *
 * Legacy `snake_case`-Schlüssel werden beim Parsen defensiv toleriert und auf
 * camelCase gemappt – aber NICHT aktiv erzeugt oder dokumentiert.
 */

export const SEGMENT_TYPES = [
  "warmup",
  "steady",
  "interval",
  "recovery",
  "tempo",
  "threshold",
  "vo2max",
  "sprint",
  "drill",
  "cooldown",
  "rest",
  "other",
] as const;

export const SEGMENT_TARGET_TYPES = [
  "rpe",
  "pace",
  "power",
  "hr",
  "cadence",
  "none",
] as const;

/** Mapping bekannter Legacy-snake_case-Schlüssel auf camelCase. */
const LEGACY_KEY_MAP: Record<string, string> = {
  duration_sec: "durationSec",
  distance_m: "distanceM",
  target_type: "targetType",
  target_value: "targetValue",
  target_value_to: "targetValueTo",
  cadence_note: "cadenceNote",
  rpe_target: "rpeTarget",
};

/** Übersetzt Legacy-Schlüssel defensiv nach camelCase. */
function normalizeSegmentKeys(input: unknown): unknown {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const mapped = LEGACY_KEY_MAP[key] ?? key;
    // camelCase hat Vorrang, falls beide Varianten vorliegen.
    if (!(mapped in out)) {
      out[mapped] = value;
    }
  }
  return out;
}

export const segmentSchema = z.preprocess(
  normalizeSegmentKeys,
  z.object({
    type: z.enum(SEGMENT_TYPES),
    durationSec: z.number().int().nonnegative().max(86400).nullable().default(null),
    distanceM: z.number().nonnegative().max(1_000_000).nullable().default(null),
    intensity: z.string().max(200).nullable().default(null),
    targetType: z.enum(SEGMENT_TARGET_TYPES).nullable().default(null),
    targetValue: z.number().nullable().default(null),
    targetValueTo: z.number().nullable().default(null),
    cadenceNote: z.string().max(200).nullable().default(null),
    rpeTarget: z.number().nullable().default(null),
    description: z.string().max(1000).nullable().default(null),
  }),
);

export type Segment = z.infer<typeof segmentSchema>;
