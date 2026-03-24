const DISTANCE_PROFILE = {
  sprint: { swimMeters: 750, bikeKm: 20, runKm: 5 },
  volkstriathlon: { swimMeters: 500, bikeKm: 20, runKm: 5 },
  olympic: { swimMeters: 1500, bikeKm: 40, runKm: 10 },
  middle: { swimMeters: 1900, bikeKm: 90, runKm: 21.1 },
  running_10k: { swimMeters: 0, bikeKm: 0, runKm: 10 }
};

/**
 * @typedef RaceInputs
 * @property {'sprint'|'volkstriathlon'|'olympic'|'middle'|'running_10k'} distance
 * @property {{pacePer100mSec:number}} swim
 * @property {{racePowerWatts:number}} bike
 * @property {{triPaceSecPerKm:number}} run
 * @property {{t1Sec?:number,t2Sec?:number}} [transitions]
 */

function bikeSpeedFromWatts(watts) {
  // conservative heuristic for beginner field conditions
  return Math.max(20, Math.min(36, 16 + watts * 0.08));
}

function round(n) {
  return Math.round(n);
}

function scenarioOffsets(type) {
  if (type === 'conservative') return { swim: 1.03, bike: 0.95, run: 1.04 };
  if (type === 'aggressive') return { swim: 0.99, bike: 1.04, run: 1.06 };
  if (type === 'negative_split') return { swim: 1.01, bike: 1.0, run: 0.98 };
  if (type === 'finish') return { swim: 1.05, bike: 0.9, run: 1.08 };
  return { swim: 1, bike: 1, run: 1 };
}

/**
 * @param {RaceInputs} inputs
 * @param {'conservative'|'realistic'|'aggressive'|'negative_split'|'finish'} scenario
 */
export function simulateRace(inputs, scenario = 'realistic') {
  const profile = DISTANCE_PROFILE[inputs.distance];
  if (!profile) throw new Error(`Unknown distance: ${inputs.distance}`);

  const offsets = scenarioOffsets(scenario);
  const swimPace = inputs.swim.pacePer100mSec * offsets.swim;
  const bikePower = inputs.bike.racePowerWatts * offsets.bike;
  const runPace = inputs.run.triPaceSecPerKm * offsets.run;

  const swimSeconds = round((profile.swimMeters / 100) * swimPace);
  const bikeSpeed = bikeSpeedFromWatts(bikePower);
  const bikeSeconds = round((profile.bikeKm / bikeSpeed) * 3600);
  const runSeconds = round(profile.runKm * runPace);

  const t1Sec = inputs.transitions?.t1Sec ?? (profile.swimMeters > 0 ? 120 : 0);
  const t2Sec = inputs.transitions?.t2Sec ?? (profile.bikeKm > 0 ? 90 : 0);

  const totalSeconds = swimSeconds + bikeSeconds + runSeconds + t1Sec + t2Sec;

  const warnings = [];
  if (scenario === 'aggressive') warnings.push('Aggressives Bike-Pacing erhöht das Risiko für Lauf-Einbruch.');
  if (bikePower > inputs.bike.racePowerWatts * 1.05) warnings.push('Bike-Leistung liegt über empfohlenem Bereich für stabilen Lauf.');
  if (scenario === 'finish') warnings.push('Finish-Fokus priorisiert Sicherheit statt Bestzeit.');

  return {
    scenario,
    splits: {
      swimSeconds,
      t1Sec,
      bikeSeconds,
      t2Sec,
      runSeconds,
      totalSeconds
    },
    pacing: {
      swimPacePer100mSec: round(swimPace),
      bikePowerWatts: round(bikePower),
      runPaceSecPerKm: round(runPace)
    },
    warnings,
    explanation:
      scenario === 'negative_split'
        ? 'Defensiver Start, stärkere zweite Rennhälfte für stabileren Laufabschluss.'
        : 'Simulation basiert auf disziplinspezifischen Heuristiken und Distanzprofil.'
  };
}

/**
 * @param {ReturnType<typeof simulateRace>} baseline
 * @param {{missedRunPerWeek?:number, extraBikeDays?:number, illnessWeeks?:number, weightDeltaKg?:number}} whatIf
 */
export function simulateWhatIfImpact(baseline, whatIf) {
  const missedRun = whatIf.missedRunPerWeek ?? 0;
  const extraBike = whatIf.extraBikeDays ?? 0;
  const illnessWeeks = whatIf.illnessWeeks ?? 0;
  const weightDelta = whatIf.weightDeltaKg ?? 0;

  let runFactor = 1 + missedRun * 0.015 + illnessWeeks * 0.02;
  runFactor -= Math.max(0, -weightDelta) * 0.005;

  let bikeFactor = 1 - extraBike * 0.01 + illnessWeeks * 0.015;
  bikeFactor += Math.max(0, weightDelta) * 0.002;

  const swimFactor = 1 + illnessWeeks * 0.01;

  const adjusted = {
    ...baseline,
    splits: {
      ...baseline.splits,
      swimSeconds: round(baseline.splits.swimSeconds * swimFactor),
      bikeSeconds: round(baseline.splits.bikeSeconds * bikeFactor),
      runSeconds: round(baseline.splits.runSeconds * runFactor)
    }
  };

  adjusted.splits.totalSeconds =
    adjusted.splits.swimSeconds +
    adjusted.splits.bikeSeconds +
    adjusted.splits.runSeconds +
    adjusted.splits.t1Sec +
    adjusted.splits.t2Sec;

  adjusted.deltaSeconds = adjusted.splits.totalSeconds - baseline.splits.totalSeconds;
  adjusted.explanation = 'What-if-Schätzung auf Basis vereinfachter Adapations-/Ausfall-Heuristiken.';

  return adjusted;
}

export function formatSeconds(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((x) => String(x).padStart(2, '0')).join(':');
}


/**
 * @param {RaceInputs} inputs
 * @param {Array<'conservative'|'realistic'|'aggressive'|'negative_split'|'finish'>} [scenarioList]
 */
export function simulateRaceScenarios(inputs, scenarioList = ['conservative', 'realistic', 'aggressive', 'negative_split', 'finish']) {
  const results = scenarioList.map((scenario) => simulateRace(inputs, scenario));

  const fastest = [...results].sort((a, b) => a.splits.totalSeconds - b.splits.totalSeconds)[0];
  const safest = [...results].sort((a, b) => a.warnings.length - b.warnings.length || a.splits.totalSeconds - b.splits.totalSeconds)[0];

  return {
    scenarios: results,
    recommendation: {
      fastest: { scenario: fastest.scenario, totalSeconds: fastest.splits.totalSeconds },
      safest: { scenario: safest.scenario, totalSeconds: safest.splits.totalSeconds }
    }
  };
}
