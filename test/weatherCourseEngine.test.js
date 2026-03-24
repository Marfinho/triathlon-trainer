import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateRace } from '../src/engine/raceSimulationEngine.js';
import { applyWeatherCourseCorrection, simulateRaceWithConditions } from '../src/engine/weatherCourseEngine.js';

test('applyWeatherCourseCorrection increases race time under tough conditions', () => {
  const baseline = simulateRace(
    {
      distance: 'olympic',
      swim: { pacePer100mSec: 145 },
      bike: { racePowerWatts: 180 },
      run: { triPaceSecPerKm: 340 }
    },
    'realistic'
  );

  const corrected = applyWeatherCourseCorrection(baseline, {
    temperatureC: 30,
    windKph: 22,
    elevationGainM: 450,
    openWater: true,
    precipitation: 'moderate'
  });

  assert.ok(corrected.splits.totalSeconds > baseline.splits.totalSeconds);
  assert.ok(corrected.deltaSeconds > 0);
});

test('simulateRaceWithConditions returns baseline and corrected payload', () => {
  const result = simulateRaceWithConditions(
    {
      distance: 'volkstriathlon',
      swim: { pacePer100mSec: 150 },
      bike: { racePowerWatts: 160 },
      run: { triPaceSecPerKm: 360 }
    },
    'realistic',
    { temperatureC: 20, windKph: 10 }
  );

  assert.equal(result.baseline.scenario, 'realistic');
  assert.equal(typeof result.corrected.deltaSeconds, 'number');
  assert.equal(result.corrected.conditions.windKph, 10);
});
