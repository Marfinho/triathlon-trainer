function estimateTrainingStress(workout) {
  const duration = Number(workout.durationMinutes ?? 0);
  const zone = Number(workout.zone ?? 1);
  return duration * (0.65 + zone * 0.2);
}

function averageStress(workouts) {
  if (!workouts.length) return 0;
  return workouts.reduce((sum, w) => sum + estimateTrainingStress(w), 0) / workouts.length;
}

/**
 * @param {import('../types.js').Workout[]} workouts
 * @param {{missedWorkoutIds?: string[], tooHardRunCount?: number, fatigueFlag?: boolean}} trigger
 */
export function adjustPlan(workouts, trigger) {
  const missedIds = new Set(trigger.missedWorkoutIds ?? []);
  const tooHardRunCount = trigger.tooHardRunCount ?? 0;
  const fatigueFlag = Boolean(trigger.fatigueFlag);

  const adjustments = [];
  const updated = workouts.map((workout) => ({ ...workout, details: [...workout.details] }));

  for (const w of updated) {
    if (missedIds.has(w.id)) {
      w.status = 'missed';
      adjustments.push({
        workoutId: w.id,
        reason: 'Einheit verpasst',
        impact: 'Nächste vergleichbare Einheit wird vereinfacht statt verdoppelt.'
      });
    }
  }

  if (tooHardRunCount >= 3) {
    let softened = 0;
    for (const w of updated) {
      if (w.sport === 'run' && w.status === 'planned' && softened < 2) {
        w.zone = Math.max(1, w.zone - 1);
        w.durationMinutes = Math.max(20, Math.round(w.durationMinutes * 0.85));
        w.why = `${w.why} Intensität reduziert, da mehrere Läufe zuletzt zu hart waren.`;
        softened += 1;
      }
    }
    adjustments.push({
      workoutId: 'multi',
      reason: 'Mehrere Läufe zu schnell',
      impact: '2 Laufeinheiten wurden leichter geplant, um Verletzungsrisiko zu senken.'
    });
  }

  if (fatigueFlag) {
    const firstHard = updated.find((w) => w.zone >= 4 && w.status === 'planned');
    if (firstHard) {
      firstHard.zone = 2;
      firstHard.details.push('Auto-Deload: Intensität gesenkt wegen Ermüdungsmarker.');
      adjustments.push({
        workoutId: firstHard.id,
        reason: 'Ermüdungsmarker erkannt',
        impact: 'Harte Einheit in lockere Stabi-Einheit umgewandelt.'
      });
    }
  }

  return {
    workouts: updated,
    changelog: adjustments
  };
}

/**
 * Apply plan adjustment and provide a simple prediction delta for transparency.
 * @param {import('../types.js').Workout[]} workouts
 * @param {{missedWorkoutIds?: string[], tooHardRunCount?: number, fatigueFlag?: boolean}} trigger
 * @param {{runTriPaceSecPerKm:number,bikeRacePowerWatts:number,swimPacePer100mSec:number}} baselineProjection
 */
export function adjustPlanWithImpact(workouts, trigger, baselineProjection) {
  const adjusted = adjustPlan(workouts, trigger);

  const beforeAvg = averageStress(workouts.filter((w) => w.status !== 'missed'));
  const afterAvg = averageStress(adjusted.workouts.filter((w) => w.status !== 'missed'));
  const stressDeltaPct = beforeAvg > 0 ? ((afterAvg - beforeAvg) / beforeAvg) * 100 : 0;

  const runDelta = Math.round(Math.max(-12, Math.min(12, stressDeltaPct * 0.8)));
  const bikeDelta = Math.round(Math.max(-10, Math.min(10, stressDeltaPct * 0.5)));
  const swimDelta = Math.round(Math.max(-6, Math.min(6, stressDeltaPct * 0.3)));

  const predictionDelta = {
    runTriPaceSecPerKm: runDelta,
    bikeRacePowerWatts: bikeDelta,
    swimPacePer100mSec: swimDelta
  };

  const projected = {
    runTriPaceSecPerKm: baselineProjection.runTriPaceSecPerKm + runDelta,
    bikeRacePowerWatts: baselineProjection.bikeRacePowerWatts + bikeDelta,
    swimPacePer100mSec: baselineProjection.swimPacePer100mSec + swimDelta
  };

  return {
    ...adjusted,
    impactSummary:
      stressDeltaPct <= -5
        ? 'Belastung wurde deutlich reduziert, kurzfristig defensivere Prognose zugunsten Regeneration.'
        : stressDeltaPct >= 5
          ? 'Belastung wurde erhöht, potenziell höhere Performance bei ausreichender Erholung.'
          : 'Belastungsänderung moderat, Prognose bleibt weitgehend stabil.',
    predictionDelta,
    projected
  };
}
