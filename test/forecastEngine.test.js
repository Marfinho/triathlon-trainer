import test from 'node:test';
import assert from 'node:assert/strict';

import {
  projectCurrentFitness,
  projectPlannedTraining,
  buildScenarioProjection,
  buildUncertaintyBand,
  compareProjectionChange,
  inferZoneDistribution
} from '../src/engine/forecastEngine.js';

test('forecast pipeline returns coherent ranges', () => {
  const completed = [
    { sport: 'run', durationMinutes: 45, zone: 2, paceSecPerKm: 370 },
    { sport: 'bike', durationMinutes: 60, zone: 2, watts: 145 },
    { sport: 'swim', durationMinutes: 40, zone: 2 },
    { sport: 'run', durationMinutes: 35, zone: 4, paceSecPerKm: 340 },
    { sport: 'bike', durationMinutes: 75, zone: 3, watts: 155 }
  ];

  const current = projectCurrentFitness({ fiveKmTimeSeconds: 1800, ftpWatts: 170 }, completed);
  const planned = projectPlannedTraining(current, { adherenceRate: 0.85, weeks: 6 });
  const lowerAdherencePlan = projectPlannedTraining(current, { adherenceRate: 0.6, weeks: 6 });
  const scenario = buildScenarioProjection(planned);
  const distribution = inferZoneDistribution(completed);
  const band = buildUncertaintyBand(planned, { confidence: current.confidence, weeksToRace: 10 });
  const delta = compareProjectionChange(lowerAdherencePlan, planned);

  assert.ok(current.confidence >= 45);
  assert.ok(planned.bikeRacePowerWatts > current.bike.racePowerWatts);
  assert.ok(scenario.optimistic.bikeRacePowerWatts > scenario.realistic.bikeRacePowerWatts);
  assert.ok(scenario.conservative.runTriPaceSecPerKm > scenario.realistic.runTriPaceSecPerKm);
  assert.ok(typeof distribution.recommendation === 'string');

  assert.ok(band.lower.runTriPaceSecPerKm < band.upper.runTriPaceSecPerKm);
  assert.ok(band.lower.bikeRacePowerWatts > band.upper.bikeRacePowerWatts);
  assert.equal(delta.delta.bikeRacePowerWatts, planned.bikeRacePowerWatts - lowerAdherencePlan.bikeRacePowerWatts);
  assert.ok(typeof delta.explanation === 'string');
});
