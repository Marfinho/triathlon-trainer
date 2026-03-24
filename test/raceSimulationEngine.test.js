import test from 'node:test';
import assert from 'node:assert/strict';

import { simulateRace, simulateRaceScenarios, simulateWhatIfImpact } from '../src/engine/raceSimulationEngine.js';

test('simulateRace returns split and pacing output for olympic distance', () => {
  const simulation = simulateRace(
    {
      distance: 'olympic',
      swim: { pacePer100mSec: 145 },
      bike: { racePowerWatts: 180 },
      run: { triPaceSecPerKm: 340 },
      transitions: { t1Sec: 130, t2Sec: 95 }
    },
    'realistic'
  );

  assert.equal(simulation.scenario, 'realistic');
  assert.ok(simulation.splits.totalSeconds > 0);
  assert.ok(simulation.pacing.bikePowerWatts > 0);
});

test('simulateRaceScenarios returns scenario bundle and recommendations', () => {
  const bundle = simulateRaceScenarios({
    distance: 'volkstriathlon',
    swim: { pacePer100mSec: 150 },
    bike: { racePowerWatts: 170 },
    run: { triPaceSecPerKm: 355 }
  });

  assert.ok(bundle.scenarios.length >= 5);
  assert.ok(bundle.recommendation.fastest.totalSeconds > 0);
  assert.ok(typeof bundle.recommendation.safest.scenario === 'string');
});

test('simulateWhatIfImpact reacts to illness and reduced run frequency', () => {
  const baseline = simulateRace(
    {
      distance: 'sprint',
      swim: { pacePer100mSec: 145 },
      bike: { racePowerWatts: 175 },
      run: { triPaceSecPerKm: 335 }
    },
    'realistic'
  );

  const impacted = simulateWhatIfImpact(baseline, {
    missedRunPerWeek: 1,
    illnessWeeks: 2,
    extraBikeDays: 0,
    weightDeltaKg: 1
  });

  assert.ok(impacted.splits.totalSeconds > baseline.splits.totalSeconds);
  assert.ok(impacted.deltaSeconds > 0);
});
