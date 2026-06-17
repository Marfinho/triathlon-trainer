/**
 * Server-only: editierbare Plan-Limits.
 *
 * `plan-limits.ts` bleibt die reine, client-sichere Default-Quelle. Hier liegt
 * die Logik, um Admin-Overrides (DB-Tabelle `PlanOverride`) über die Defaults
 * zu legen.
 *
 * Wichtig: JSON kennt kein `Infinity`. In `settingsJson` wird "unbegrenzt" als
 * `null` gespeichert; `mergeLimits` setzt es beim Lesen wieder auf `Infinity`.
 */
import { prisma } from "@/lib/db";
import { PLAN_LIMITS, getLimits, type PlanTier } from "@/lib/plan-limits";

export interface PlanLimitsShape {
  planHorizonDays: number;
  maxRaceEvents: number;
  maxPlanImportsPerMonth: number;
  maxGearItems: number;
  maxGearComponents: number;
  maxActiveIntegrations: number;
  activityHistoryDays: number;
  syncIntervalMinutes: number;
  pmcHorizonDays: number;
  allowedPredictionSports: string[];
  weeklyReport: boolean;
  manualBackupCooldownHours: number;
}

/** Numerische Felder, bei denen `null` im Override "unbegrenzt" (Infinity) meint. */
const NUMERIC_KEYS = [
  "planHorizonDays",
  "maxRaceEvents",
  "maxPlanImportsPerMonth",
  "maxGearItems",
  "maxGearComponents",
  "maxActiveIntegrations",
  "activityHistoryDays",
  "syncIntervalMinutes",
  "pmcHorizonDays",
  "manualBackupCooldownHours",
] as const satisfies readonly (keyof PlanLimitsShape)[];

/** Partielle Override-Map, wie sie in `settingsJson` abgelegt wird. */
export type PlanOverrideSettings = Partial<{
  planHorizonDays: number | null;
  maxRaceEvents: number | null;
  maxPlanImportsPerMonth: number | null;
  maxGearItems: number | null;
  maxGearComponents: number | null;
  maxActiveIntegrations: number | null;
  activityHistoryDays: number | null;
  syncIntervalMinutes: number | null;
  pmcHorizonDays: number | null;
  allowedPredictionSports: string[];
  weeklyReport: boolean;
  manualBackupCooldownHours: number | null;
}>;

function toPlainLimits(plan: string): PlanLimitsShape {
  const d = getLimits(plan);
  return {
    planHorizonDays: d.planHorizonDays,
    maxRaceEvents: d.maxRaceEvents,
    maxPlanImportsPerMonth: d.maxPlanImportsPerMonth,
    maxGearItems: d.maxGearItems,
    maxGearComponents: d.maxGearComponents,
    maxActiveIntegrations: d.maxActiveIntegrations,
    activityHistoryDays: d.activityHistoryDays,
    syncIntervalMinutes: d.syncIntervalMinutes,
    pmcHorizonDays: d.pmcHorizonDays,
    allowedPredictionSports: [...d.allowedPredictionSports],
    weeklyReport: d.weeklyReport,
    manualBackupCooldownHours: d.manualBackupCooldownHours,
  };
}

const NUMERIC_KEY_SET = new Set<string>(NUMERIC_KEYS);

/**
 * Reiner Deep-Merge von Default-Limits + Override. Testbar ohne DB.
 * - numerische Felder: `null` -> Infinity, sonst der Zahlwert
 * - allowedPredictionSports: ersetzt das Array, falls vorhanden
 * - weeklyReport: ersetzt den Bool, falls vorhanden
 */
export function mergeLimits(
  defaults: PlanLimitsShape,
  override: PlanOverrideSettings | null | undefined,
): PlanLimitsShape {
  const out: PlanLimitsShape = {
    ...defaults,
    allowedPredictionSports: [...defaults.allowedPredictionSports],
  };
  if (!override) return out;

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    if (key === "allowedPredictionSports") {
      if (Array.isArray(value)) out.allowedPredictionSports = [...value];
      continue;
    }
    if (key === "weeklyReport") {
      if (typeof value === "boolean") out.weeklyReport = value;
      continue;
    }
    if (NUMERIC_KEY_SET.has(key)) {
      if (value === null) {
        (out as unknown as Record<string, unknown>)[key] = Infinity;
      } else if (typeof value === "number" && Number.isFinite(value)) {
        (out as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }
  return out;
}

/** Liefert die Default-Limits eines Tiers als reines (Infinity-fähiges) Objekt. */
export function defaultLimits(plan: string): PlanLimitsShape {
  return toPlainLimits(plan);
}

/**
 * Effektive Limits eines Tiers: Defaults + DB-Override. Async, server-only.
 * Fällt bei DB-Fehlern auf die Defaults zurück (Enforcement bleibt funktional).
 */
export async function getEffectiveLimits(
  plan: string,
): Promise<PlanLimitsShape> {
  const defaults = toPlainLimits(plan);
  try {
    const row = await prisma.planOverride.findUnique({ where: { tier: plan } });
    if (!row) return defaults;
    return mergeLimits(defaults, row.settingsJson as PlanOverrideSettings);
  } catch {
    return defaults;
  }
}

/** Wandelt effektive Limits (mit Infinity) in eine JSON-sichere Form (null). */
export function toJsonSafeLimits(
  limits: PlanLimitsShape,
): Record<string, number | null | boolean | string[]> {
  const out: Record<string, number | null | boolean | string[]> = {};
  for (const [key, value] of Object.entries(limits)) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      out[key] = null;
    } else {
      out[key] = value as number | boolean | string[];
    }
  }
  return out;
}

/** Liste der bekannten Tiers (Quelle: PLAN_LIMITS). */
export function knownTiers(): PlanTier[] {
  return Object.keys(PLAN_LIMITS) as PlanTier[];
}

/**
 * Schreibt/aktualisiert den Override eines Tiers. Sanitisiert auf bekannte
 * Felder; unbekannte Keys werden verworfen.
 */
export async function setPlanOverride(
  tier: string,
  settings: PlanOverrideSettings,
  updatedBy?: string,
): Promise<PlanLimitsShape> {
  const clean = sanitizeOverride(settings);
  await prisma.planOverride.upsert({
    where: { tier },
    create: { tier, settingsJson: clean as object, updatedBy: updatedBy ?? null },
    update: { settingsJson: clean as object, updatedBy: updatedBy ?? null },
  });
  return getEffectiveLimits(tier);
}

/** Behält nur bekannte Felder mit gültigen Typen. */
export function sanitizeOverride(
  settings: PlanOverrideSettings,
): PlanOverrideSettings {
  const out: PlanOverrideSettings = {};
  for (const key of NUMERIC_KEYS) {
    const v = settings[key];
    if (v === null) {
      out[key] = null;
    } else if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[key] = v;
    }
  }
  if (Array.isArray(settings.allowedPredictionSports)) {
    out.allowedPredictionSports = settings.allowedPredictionSports.filter(
      (s): s is string => typeof s === "string",
    );
  }
  if (typeof settings.weeklyReport === "boolean") {
    out.weeklyReport = settings.weeklyReport;
  }
  return out;
}
