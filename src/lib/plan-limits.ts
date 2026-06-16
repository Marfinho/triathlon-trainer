/**
 * Zentrale Plan-Limits (Free vs. Paid). Einzige Quelle der Wahrheit für alle
 * Gates (HARD, SOFT, QUERY, FEATURE).
 */
export const PLAN_LIMITS = {
  free: {
    planHorizonDays: 28,
    maxRaceEvents: 3,
    maxPlanImportsPerMonth: 2,
    maxGearItems: 5,
    maxGearComponents: 2,
    maxActiveIntegrations: 1,
    activityHistoryDays: 90,
    syncIntervalMinutes: 1440,
    pmcHorizonDays: 56,
    allowedPredictionSports: ["run"],
    weeklyReport: false,
    manualBackupCooldownHours: 168,
  },
  paid: {
    planHorizonDays: Infinity,
    maxRaceEvents: Infinity,
    maxPlanImportsPerMonth: Infinity,
    maxGearItems: Infinity,
    maxGearComponents: Infinity,
    maxActiveIntegrations: Infinity,
    activityHistoryDays: Infinity,
    syncIntervalMinutes: 30,
    pmcHorizonDays: Infinity,
    allowedPredictionSports: ["run", "bike", "swim", "triathlon"],
    weeklyReport: true,
    manualBackupCooldownHours: 0,
  },
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;
export type PlanLimits = (typeof PLAN_LIMITS)[PlanTier];

export function getLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as PlanTier] ?? PLAN_LIMITS.free;
}

/** True, wenn der Plan ein qualitatives Feature freischaltet (FEATURE-GATE). */
export function hasFeature(plan: string, feature: "weeklyReport"): boolean {
  return Boolean(getLimits(plan)[feature]);
}

/** True, wenn die Vorhersage für die Sportart erlaubt ist. */
export function allowsPredictionSport(plan: string, sport: string): boolean {
  return (getLimits(plan).allowedPredictionSports as readonly string[]).includes(
    sport,
  );
}

/** Helfer: numerisches Limit unbegrenzt? */
export function isUnlimited(value: number): boolean {
  return value === Infinity;
}
