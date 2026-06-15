import {
  SCHEMA_VERSION,
  SUMMARY_MODULES,
  type ChatGptInstruction,
  type CoachSummary,
  type ExportPurpose,
  type SummaryModule,
} from "@/domain/schemas";
import { MODULE_PRESETS, MODULE_CONTEXT_KEY } from "./presets";

/**
 * Erzeugt eine modulare `coach_summary` (rein, ohne DB-Zugriff). Die Persistenz
 * als `CoachSummaryExport` übernimmt der Aufrufer (API-Route) – so bleibt die
 * Funktion einfach testbar.
 */

export interface CoachSummaryContext {
  athleteProfile?: unknown;
  seasonContext?: unknown;
  planningConstraints?: unknown;
  recentTrainingSummary?: unknown;
  recentActivities?: unknown;
  currentPlannedWorkouts?: unknown;
  readiness?: unknown;
  painStatus?: unknown;
  syncState?: unknown;
  coachNotes?: unknown;
}

export interface BuildCoachSummaryParams {
  exportPurpose: ExportPurpose;
  athleteId?: string | null;
  planStart: string;
  planDays: number;
  language?: string;
  timezone?: string;
  context?: CoachSummaryContext;
  /** Überschreibt das Preset komplett. */
  includeModules?: SummaryModule[];
  /** Entfernt einzelne Module aus dem (Preset-/Override-)Set. */
  excludeModules?: SummaryModule[];
  generatedAt?: string;
}

function resolveModules(params: BuildCoachSummaryParams): SummaryModule[] {
  const base = params.includeModules ?? MODULE_PRESETS[params.exportPurpose];
  const excluded = new Set(params.excludeModules ?? []);
  const selected = new Set(base.filter((m) => !excluded.has(m)));
  // Stabile, kanonische Reihenfolge gemäß SUMMARY_MODULES.
  return SUMMARY_MODULES.filter((m) => selected.has(m));
}

function buildChatGptInstruction(
  params: BuildCoachSummaryParams,
): ChatGptInstruction {
  return {
    role: "Du bist mein Triathlon-/Ausdauercoach.",
    outputFormat:
      "Antworte ausschließlich mit einem gültigen localhub_plan JSON-Objekt – kein Markdown, kein erklärender Text davor oder danach.",
    rules: [
      `Erzeuge exakt ${params.planDays} Tage ab ${params.planStart} (lückenlos, jeder Tag genau einmal abgedeckt).`,
      'Ruhetage als sport "rest" mit plannedDurationMin: 0 und leeren segments [].',
      "Trainingstage haben plannedDurationMin > 0.",
      "Überschreibe oder verändere keine completed Aktivitäten aus recent_activities oder current_planned_workouts.",
      "Verpasste Einheiten nicht stumpf stapeln, sondern sinnvoll in die Restwoche integrieren.",
      "Verwende das aktive camelCase-Segmentformat (durationSec, distanceM, targetType …).",
      "Halte dich an das Schema localhub_plan (type, schemaVersion, planStart, planDays, planEnd, entries[]).",
    ],
  };
}

export function buildCoachSummary(
  params: BuildCoachSummaryParams,
): CoachSummary {
  const includedModules = resolveModules(params);
  const context = params.context ?? {};

  const modules: Record<string, unknown> = {};
  for (const moduleName of includedModules) {
    const key = MODULE_CONTEXT_KEY[moduleName] as keyof CoachSummaryContext;
    modules[moduleName] = context[key] ?? null;
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    type: "coach_summary",
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    athleteId: params.athleteId ?? null,
    exportPurpose: params.exportPurpose,
    requestedOutput: {
      format: "localhub_plan_json",
      planStart: params.planStart,
      planDays: params.planDays,
      language: params.language ?? "de",
      timezone: params.timezone ?? "Europe/Berlin",
    },
    includedModules,
    modules,
    chatGptInstruction: buildChatGptInstruction(params),
  };
}
