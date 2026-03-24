import test from 'node:test';
import assert from 'node:assert/strict';

import { adjustPlan, adjustPlanWithImpact } from '../src/engine/adjustmentEngine.js';

test('adjustPlan softens future runs after repeated too-hard sessions', () => {
  const workouts = [
    {
      id: 'w1',
      date: '2026-03-24',
      sport: 'run',
      durationMinutes: 50,
      zone: 4,
      details: ['hart'],
      goal: 'tempo',
      why: 'test',
      status: 'planned'
    },
    {
      id: 'w2',
      date: '2026-03-25',
      sport: 'run',
      durationMinutes: 45,
      zone: 3,
      details: ['mittel'],
      goal: 'stabil',
      why: 'test',
      status: 'planned'
    },
    {
      id: 'w3',
      date: '2026-03-26',
      sport: 'bike',
      durationMinutes: 60,
      zone: 4,
      details: ['bike hard'],
      goal: 'bike',
      why: 'test',
      status: 'planned'
    }
  ];

  const result = adjustPlan(workouts, { missedWorkoutIds: ['w3'], tooHardRunCount: 3, fatigueFlag: true });

  const runAdjusted = result.workouts.filter((w) => w.sport === 'run');
  assert.equal(result.workouts.find((w) => w.id === 'w3')?.status, 'missed');
  assert.ok(runAdjusted.some((w) => w.zone <= 3));
  assert.ok(result.changelog.length >= 2);
});

test('adjustPlanWithImpact returns prediction delta and projected values', () => {
  const workouts = [
    {
      id: 'w1',
      date: '2026-03-24',
      sport: 'run',
      durationMinutes: 60,
      zone: 4,
      details: ['hart'],
      goal: 'tempo',
      why: 'test',
      status: 'planned'
    },
    {
      id: 'w2',
      date: '2026-03-25',
      sport: 'bike',
      durationMinutes: 70,
      zone: 4,
      details: ['hart'],
      goal: 'bike',
      why: 'test',
      status: 'planned'
    }
  ];

  const result = adjustPlanWithImpact(
    workouts,
    { fatigueFlag: true, tooHardRunCount: 3 },
    { runTriPaceSecPerKm: 355, bikeRacePowerWatts: 158, swimPacePer100mSec: 143 }
  );

  assert.equal(typeof result.predictionDelta.runTriPaceSecPerKm, 'number');
  assert.equal(typeof result.projected.bikeRacePowerWatts, 'number');
  assert.ok(typeof result.impactSummary === 'string' && result.impactSummary.length > 10);
});
