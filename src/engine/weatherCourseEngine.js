import { simulateRace } from './raceSimulationEngine.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * @param {ReturnType<typeof simulateRace>} baseline
 * @param {{temperatureC?:number,windKph?:number,elevationGainM?:number,openWater?:boolean,precipitation?:'none'|'light'|'moderate'|'heavy'}} conditions
 */
export function applyWeatherCourseCorrection(baseline, conditions = {}) {
  const temperature = conditions.temperatureC ?? 18;
  const windKph = conditions.windKph ?? 0;
  const elevation = conditions.elevationGainM ?? 0;
  const openWater = Boolean(conditions.openWater);
  const rain = conditions.precipitation ?? 'none';

  const heatPenalty = temperature > 22 ? clamp((temperature - 22) * 0.004, 0, 0.08) : 0;
  const windPenalty = clamp(windKph * 0.003, 0, 0.1);
  const elevationPenalty = clamp(elevation / 3000, 0, 0.12);
  const rainPenalty = rain === 'heavy' ? 0.06 : rain === 'moderate' ? 0.03 : rain === 'light' ? 0.01 : 0;
  const openWaterPenalty = openWater ? 0.03 : 0;

  const swimFactor = 1 + heatPenalty * 0.3 + openWaterPenalty;
  const bikeFactor = 1 + windPenalty + elevationPenalty * 0.7 + rainPenalty;
  const runFactor = 1 + heatPenalty + elevationPenalty * 0.3 + rainPenalty * 0.4;

  const corrected = {
    ...baseline,
    splits: {
      ...baseline.splits,
      swimSeconds: Math.round(baseline.splits.swimSeconds * swimFactor),
      bikeSeconds: Math.round(baseline.splits.bikeSeconds * bikeFactor),
      runSeconds: Math.round(baseline.splits.runSeconds * runFactor)
    },
    conditions: {
      temperatureC: temperature,
      windKph,
      elevationGainM: elevation,
      openWater,
      precipitation: rain
    }
  };

  corrected.splits.totalSeconds =
    corrected.splits.swimSeconds +
    corrected.splits.bikeSeconds +
    corrected.splits.runSeconds +
    corrected.splits.t1Sec +
    corrected.splits.t2Sec;

  corrected.deltaSeconds = corrected.splits.totalSeconds - baseline.splits.totalSeconds;
  corrected.explanation =
    'Korrigierte Rennprognose unter Berücksichtigung von Temperatur, Wind, Höhenmetern, Niederschlag und Freiwasserfaktor.';

  return corrected;
}

/**
 * @param {import('./raceSimulationEngine.js').RaceInputs} inputs
 * @param {'conservative'|'realistic'|'aggressive'|'negative_split'|'finish'} scenario
 * @param {{temperatureC?:number,windKph?:number,elevationGainM?:number,openWater?:boolean,precipitation?:'none'|'light'|'moderate'|'heavy'}} conditions
 */
export function simulateRaceWithConditions(inputs, scenario = 'realistic', conditions = {}) {
  const baseline = simulateRace(inputs, scenario);
  return {
    baseline,
    corrected: applyWeatherCourseCorrection(baseline, conditions)
  };
}
