import { z } from "zod";

/** Aktuelle Schema-Version der aktiven JSON-Formate. */
export const SCHEMA_VERSION = "1.0";

/** Gültige Sportarten in geplanten Workouts / Planeinträgen. */
export const SPORTS = [
  "run",
  "bike",
  "swim",
  "strength",
  "brick",
  "mobility",
  "walk",
  "cross_training",
  "other",
  "rest",
] as const;
export type Sport = (typeof SPORTS)[number];

export const sportSchema = z.enum(SPORTS);

/** Status-Werte eines geplanten Workouts. */
export const PLANNED_WORKOUT_STATUSES = [
  "planned",
  "synced",
  "completed",
  "skipped",
  "cancelled",
  "replaced",
] as const;
export type PlannedWorkoutStatus = (typeof PLANNED_WORKOUT_STATUSES)[number];

/** Offene (durch Import ersetzbare) Status. `completed` ist niemals dabei. */
export const OPEN_STATUSES: PlannedWorkoutStatus[] = ["planned", "synced"];

/** Datum im Format YYYY-MM-DD. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD vorliegen");

/** Zeitstempel (ISO 8601). */
export const isoDateTimeSchema = z.string().datetime({ offset: true }).or(
  z.string().regex(/^\d{4}-\d{2}-\d{2}T/, "Ungültiger Zeitstempel"),
);
