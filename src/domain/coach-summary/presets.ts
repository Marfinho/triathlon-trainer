import type { ExportPurpose, SummaryModule } from "@/domain/schemas";

/**
 * Standard-Module je Export-Zweck. Über `includeModules`/`excludeModules` lassen
 * sich diese Presets beim Aufruf von `buildCoachSummary` überschreiben.
 */
export const MODULE_PRESETS: Record<ExportPurpose, SummaryModule[]> = {
  training_plan: [
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
  ],
  plan_review: [
    "current_planned_workouts",
    "recent_activities",
    "recent_training_summary",
    "readiness",
    "coach_notes",
  ],
  week_analysis: [
    "recent_training_summary",
    "recent_activities",
    "current_planned_workouts",
    "readiness",
  ],
  recovery_check: ["readiness", "recent_training_summary", "recent_activities"],
  pain_check: ["pain_status", "recent_activities", "current_planned_workouts"],
  strategy_question: [
    "athlete_profile",
    "season_context",
    "planning_constraints",
    "coach_notes",
  ],
  debug: [
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
  ],
};

/** Zuordnung Modulname -> Schlüssel im Eingabe-Kontext. */
export const MODULE_CONTEXT_KEY: Record<SummaryModule, string> = {
  athlete_profile: "athleteProfile",
  season_context: "seasonContext",
  planning_constraints: "planningConstraints",
  recent_training_summary: "recentTrainingSummary",
  recent_activities: "recentActivities",
  current_planned_workouts: "currentPlannedWorkouts",
  readiness: "readiness",
  pain_status: "painStatus",
  sync_state: "syncState",
  coach_notes: "coachNotes",
};
