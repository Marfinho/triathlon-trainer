import {
  localhubPlanSchema,
  type LocalhubPlan,
  type PlanEntry,
  OPEN_STATUSES,
  type PlannedWorkoutStatus,
} from "@/domain/schemas";
import {
  parseIsoDate,
  formatIsoDate,
  addDays,
  eachIsoDateInRange,
  diffInDays,
} from "@/domain/training/dates";

/**
 * Hartes Validieren eines `localhub_plan`. Bei JEDEM Fehler werden alle
 * gefundenen Probleme gesammelt zurückgegeben; es wird KEINE Datenbank verändert
 * (diese Funktion ist rein – existierende Workouts werden als Parameter
 * übergeben, nicht selbst geladen).
 */

export interface ExistingWorkoutRef {
  id: string;
  /** Datum als Date oder `YYYY-MM-DD`. */
  date: Date | string;
  status: PlannedWorkoutStatus | string;
  title?: string;
}

export interface ExpectedExportRef {
  planStart: string; // YYYY-MM-DD
  planDays: number;
}

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

export interface ValidateOptions {
  /** Bereits vorhandene geplante Workouts (z.B. aus der DB) zum Abgleich. */
  existingWorkouts?: ExistingWorkoutRef[];
  /** Letzter CoachSummary-Export für Abgleich von planStart/planDays. */
  expectedExport?: ExpectedExportRef | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  plan?: LocalhubPlan;
  /** `completed` Workouts im Zeitraum – unantastbar. */
  protectedActivities: ExistingWorkoutRef[];
  /** Offene (planned/synced) Workouts im Zeitraum – werden ersetzt. */
  replaceableWorkouts: ExistingWorkoutRef[];
  meta?: {
    planStart: string;
    planEnd: string;
    planDays: number;
    dates: string[];
  };
}

const DURATION_TOLERANCE_MIN = 5;
const DURATION_TOLERANCE_RATIO = 0.15;
const SWIM_DISTANCE_TOLERANCE_M = 50;
const SWIM_DISTANCE_TOLERANCE_RATIO = 0.05;

function toIsoDate(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : formatIsoDate(value);
}

function validateEntryBusinessRules(
  entry: PlanEntry,
  index: number,
  errors: ValidationError[],
): void {
  const path = `entries[${index}]`;

  if (entry.sport === "rest") {
    // Ruhetag: Dauer 0, keine Segmente.
    if (entry.plannedDurationMin !== 0) {
      errors.push({
        code: "REST_DAY_NONZERO_DURATION",
        message: `Ruhetag (${entry.date}) muss plannedDurationMin 0 haben, ist ${entry.plannedDurationMin}.`,
        path: `${path}.plannedDurationMin`,
      });
    }
    if (entry.segments.length > 0) {
      errors.push({
        code: "REST_DAY_HAS_SEGMENTS",
        message: `Ruhetag (${entry.date}) darf keine Segmente enthalten.`,
        path: `${path}.segments`,
      });
    }
    return;
  }

  // Trainingstag: Dauer > 0.
  if (entry.plannedDurationMin <= 0) {
    errors.push({
      code: "TRAINING_DAY_ZERO_DURATION",
      message: `Trainingstag (${entry.date}, ${entry.sport}) muss plannedDurationMin > 0 haben.`,
      path: `${path}.plannedDurationMin`,
    });
  }

  // Segmentdauer plausibel zur Gesamtdauer (nur wenn alle Segmente eine Dauer
  // haben).
  if (entry.segments.length > 0) {
    const allHaveDuration = entry.segments.every(
      (s) => typeof s.durationSec === "number",
    );
    if (allHaveDuration) {
      const segmentMin =
        entry.segments.reduce((sum, s) => sum + (s.durationSec ?? 0), 0) / 60;
      const tolerance = Math.max(
        DURATION_TOLERANCE_MIN,
        entry.plannedDurationMin * DURATION_TOLERANCE_RATIO,
      );
      if (Math.abs(segmentMin - entry.plannedDurationMin) > tolerance) {
        errors.push({
          code: "SEGMENT_DURATION_MISMATCH",
          message: `Segmentdauer (${segmentMin.toFixed(
            1,
          )} min) weicht zu stark von plannedDurationMin (${
            entry.plannedDurationMin
          } min) ab (${entry.date}).`,
          path: `${path}.segments`,
        });
      }
    }
  }

  // Schwimmdistanz: Segmentdistanzen müssen mit plannedDistanceM übereinstimmen.
  if (
    entry.sport === "swim" &&
    typeof entry.plannedDistanceM === "number" &&
    entry.plannedDistanceM > 0 &&
    entry.segments.length > 0
  ) {
    const allHaveDistance = entry.segments.every(
      (s) => typeof s.distanceM === "number",
    );
    if (allHaveDistance) {
      const segmentDistance = entry.segments.reduce(
        (sum, s) => sum + (s.distanceM ?? 0),
        0,
      );
      const tolerance = Math.max(
        SWIM_DISTANCE_TOLERANCE_M,
        entry.plannedDistanceM * SWIM_DISTANCE_TOLERANCE_RATIO,
      );
      if (Math.abs(segmentDistance - entry.plannedDistanceM) > tolerance) {
        errors.push({
          code: "SWIM_DISTANCE_MISMATCH",
          message: `Summe der Segmentdistanzen (${segmentDistance} m) weicht von plannedDistanceM (${entry.plannedDistanceM} m) ab (${entry.date}).`,
          path: `${path}.plannedDistanceM`,
        });
      }
    }
  }
}

export function validateLocalhubPlan(
  raw: unknown,
  options: ValidateOptions = {},
): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Strukturelle Validierung (Schema-Version, type, Felder, Segmente).
  const parsed = localhubPlanSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        code: "SCHEMA_INVALID",
        message: issue.message,
        path: issue.path.join("."),
      });
    }
    return {
      valid: false,
      errors,
      protectedActivities: [],
      replaceableWorkouts: [],
    };
  }

  const plan = parsed.data;

  // 2. planStart / planDays / planEnd konsistent.
  const startDate = parseIsoDate(plan.planStart);
  const endDate = parseIsoDate(plan.planEnd);
  const expectedEnd = addDays(startDate, plan.planDays - 1);
  if (formatIsoDate(expectedEnd) !== plan.planEnd) {
    errors.push({
      code: "PLAN_END_INCONSISTENT",
      message: `planEnd (${plan.planEnd}) passt nicht zu planStart (${
        plan.planStart
      }) + planDays (${plan.planDays}); erwartet ${formatIsoDate(expectedEnd)}.`,
      path: "planEnd",
    });
  }
  if (diffInDays(startDate, endDate) < 0) {
    errors.push({
      code: "PLAN_RANGE_REVERSED",
      message: `planEnd (${plan.planEnd}) liegt vor planStart (${plan.planStart}).`,
      path: "planEnd",
    });
  }

  // 3. Abgleich mit letztem CoachSummary-Export (optional).
  if (options.expectedExport) {
    const exp = options.expectedExport;
    if (exp.planStart !== plan.planStart || exp.planDays !== plan.planDays) {
      errors.push({
        code: "EXPORT_MISMATCH",
        message: `Plan (start ${plan.planStart}, ${plan.planDays} Tage) passt nicht zum letzten Export (start ${exp.planStart}, ${exp.planDays} Tage).`,
      });
    }
  }

  // 4. Tagesabdeckung + keine Einträge außerhalb des Zeitraums.
  const expectedDates = eachIsoDateInRange(plan.planStart, plan.planDays);
  const expectedSet = new Set(expectedDates);
  const coveredDates = new Set<string>();
  plan.entries.forEach((entry, index) => {
    if (!expectedSet.has(entry.date)) {
      errors.push({
        code: "ENTRY_OUT_OF_RANGE",
        message: `Eintrag mit Datum ${entry.date} liegt außerhalb des Planzeitraums (${plan.planStart} … ${plan.planEnd}).`,
        path: `entries[${index}].date`,
      });
    } else {
      coveredDates.add(entry.date);
    }
  });
  for (const date of expectedDates) {
    if (!coveredDates.has(date)) {
      errors.push({
        code: "DAY_NOT_COVERED",
        message: `Tag ${date} ist im Plan nicht abgedeckt.`,
        path: "entries",
      });
    }
  }

  // 5. Fachregeln pro Eintrag (Ruhetage, Dauer, Segmentsummen, Schwimmdistanz).
  plan.entries.forEach((entry, index) =>
    validateEntryBusinessRules(entry, index, errors),
  );

  // 6. Geschützte (completed) und ersetzbare (offene) Workouts ermitteln.
  const protectedActivities: ExistingWorkoutRef[] = [];
  const replaceableWorkouts: ExistingWorkoutRef[] = [];
  for (const existing of options.existingWorkouts ?? []) {
    const date = toIsoDate(existing.date);
    if (!expectedSet.has(date)) continue;
    if (existing.status === "completed") {
      protectedActivities.push(existing);
    } else if (OPEN_STATUSES.includes(existing.status as PlannedWorkoutStatus)) {
      replaceableWorkouts.push(existing);
    }
    // andere Status (skipped/cancelled/replaced) werden nicht angetastet.
  }

  return {
    valid: errors.length === 0,
    errors,
    plan: errors.length === 0 ? plan : undefined,
    protectedActivities,
    replaceableWorkouts,
    meta: {
      planStart: plan.planStart,
      planEnd: plan.planEnd,
      planDays: plan.planDays,
      dates: expectedDates,
    },
  };
}
