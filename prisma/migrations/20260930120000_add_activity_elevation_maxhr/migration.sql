-- AlterTable
ALTER TABLE "ActualActivity" ADD COLUMN "maxHr" INTEGER,
ADD COLUMN "elevationGainM" DOUBLE PRECISION;

-- Backfill aus den gespeicherten Intervals.icu-Rohdaten (Max-HF, Höhenmeter, RPE).
UPDATE "ActualActivity"
SET
  "maxHr" = CASE WHEN jsonb_typeof("rawJson"->'max_heartrate') = 'number'
    THEN ROUND(("rawJson"->>'max_heartrate')::numeric)::integer END,
  "elevationGainM" = CASE WHEN jsonb_typeof("rawJson"->'total_elevation_gain') = 'number'
    THEN ("rawJson"->>'total_elevation_gain')::double precision END,
  "rpe" = COALESCE("rpe", CASE WHEN jsonb_typeof("rawJson"->'icu_rpe') = 'number'
    AND ("rawJson"->>'icu_rpe')::double precision > 0
    THEN ("rawJson"->>'icu_rpe')::double precision END)
WHERE "source" = 'intervals' AND jsonb_typeof("rawJson") = 'object';
