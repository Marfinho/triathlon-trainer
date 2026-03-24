const RULESET_VERSION = 'v1.2.0';
const PRIORITY_ORDER = { A: 0, B: 1, C: 2 };

function daysUntil(targetDate, referenceDate) {
  const target = new Date(`${targetDate}T00:00:00Z`);
  const ref = new Date(`${referenceDate}T00:00:00Z`);
  return Math.ceil((target.getTime() - ref.getTime()) / (24 * 3600 * 1000));
}

function toDateOnly(input) {
  if (!input) return new Date().toISOString().slice(0, 10);
  const asDate = new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(asDate.getTime())) {
    throw new Error('Invalid context.today date. Expected format YYYY-MM-DD');
  }
  return asDate.toISOString().slice(0, 10);
}

function sortedByDateDesc(workouts) {
  return [...workouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function assertWorkouts(workouts) {
  if (!Array.isArray(workouts)) {
    throw new Error('workouts must be an array');
  }

  for (const [index, workout] of workouts.entries()) {
    if (!workout || typeof workout !== 'object') {
      throw new Error(`workouts[${index}] must be an object`);
    }

    if (!workout.date) {
      throw new Error(`workouts[${index}].date is required`);
    }

    const parsedDate = new Date(`${workout.date}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error(`workouts[${index}].date is invalid`);
    }

    if (!Number.isFinite(workout.zone)) {
      throw new Error(`workouts[${index}].zone must be numeric`);
    }
  }
}

function selectUpcomingRace(races, today) {
  return [...races]
    .map((race) => ({ ...race, daysUntil: daysUntil(race.date, today) }))
    .filter((race) => Number.isFinite(race.daysUntil) && race.daysUntil >= 0)
    .sort((a, b) => {
      const byPriority = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      if (byPriority !== 0) return byPriority;
      return a.daysUntil - b.daysUntil;
    })[0];
}

/**
 * Evaluate rule-based coaching recommendations.
 * @param {Array<{id?:string,date:string,sport:string,zone:number,executedZone?:number,status?:'planned'|'done'|'missed'}>} workouts
 * @param {{today?:string,races?:Array<{id:string,date:string,priority?:'A'|'B'|'C'}>,metrics?:{bikeTrend?:number,runTrend?:number}}} [context]
 */
export function evaluateRules(workouts, context = {}) {
  assertWorkouts(workouts);

  const today = toDateOnly(context.today);
  const done = workouts.filter((w) => w.status !== 'missed');
  const recent = sortedByDateDesc(done).slice(0, 20);

  const recommendations = [];

  const lastFive = recent.slice(0, 5);
  const hardDays = lastFive.filter((w) => w.zone >= 4).length;
  if (hardDays >= 3) {
    recommendations.push({
      ruleId: 'hard-days-5-window',
      severity: 'high',
      action: 'reduce_load',
      explanation:
        'In den letzten 5 Einheiten waren mindestens 3 sehr intensiv. Plane 1-2 lockere Tage für bessere Anpassung.',
      evidence: { hardDays, sampleSize: lastFive.length }
    });
  }

  const upcomingRace = selectUpcomingRace(context.races ?? [], today);

  if (upcomingRace && upcomingRace.daysUntil <= 14) {
    const plannedHard = workouts.filter((w) => w.status === 'planned' && w.zone >= 4).length;
    if (plannedHard > 0) {
      recommendations.push({
        ruleId: 'race-in-14-days',
        severity: 'medium',
        action: 'protect_taper',
        explanation:
          `Der priorisierte Wettkampf (${upcomingRace.priority ?? '-'}) ist in ${upcomingRace.daysUntil} Tagen. Keine neuen Spitzenreize mehr setzen, Fokus auf Frische.`,
        evidence: {
          raceId: upcomingRace.id,
          priority: upcomingRace.priority ?? null,
          daysUntil: upcomingRace.daysUntil,
          plannedHard
        }
      });
    }
  }

  const easyRunTargets = done.filter((w) => w.sport === 'run' && w.zone <= 2);
  const tooHardEasyRuns = easyRunTargets.filter((w) => w.executedZone && w.executedZone >= 3).length;
  if (easyRunTargets.length >= 3 && tooHardEasyRuns / easyRunTargets.length >= 0.5) {
    recommendations.push({
      ruleId: 'easy-runs-too-hard',
      severity: 'medium',
      action: 'lower_pacing_targets',
      explanation:
        'Viele lockere Läufe wurden zu hart absolviert. Reduziere Pace-Vorgaben und nutze Talk-Test als Leitplanke.',
      evidence: { tooHardEasyRuns, easyRuns: easyRunTargets.length }
    });
  }

  const bikeTrend = context.metrics?.bikeTrend ?? 0;
  const runTrend = context.metrics?.runTrend ?? 0;
  if (bikeTrend >= 0.03 && runTrend <= 0.005) {
    recommendations.push({
      ruleId: 'bike-up-run-flat',
      severity: 'low',
      action: 'increase_run_economy_focus',
      explanation:
        'Radleistung steigt, Lauf stagniert. Ergänze Lauf-ABC, kurze Koppelläufe und ökonomische Schwellenintervalle.',
      evidence: { bikeTrend, runTrend }
    });
  }

  return {
    rulesetVersion: RULESET_VERSION,
    evaluatedAt: today,
    recommendationCount: recommendations.length,
    recommendations,
    summary:
      recommendations.length === 0
        ? 'Keine akuten Flags. Progression kann planmäßig fortgesetzt werden.'
        : 'Regel-Engine hat Anpassungsbedarf erkannt. Empfehlungen vor der nächsten Plananpassung prüfen.'
  };
}
