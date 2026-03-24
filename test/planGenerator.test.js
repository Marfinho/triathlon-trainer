import test from 'node:test';
import assert from 'node:assert/strict';

import { generateSixMonthPlan } from '../src/engine/planGenerator.js';

test('generateSixMonthPlan creates 26 weeks and prioritizes next race', () => {
  const profile = {
    id: 'u1',
    fitnessLevel: 'beginner',
    sessionsPerWeek: 5,
    maxSessionMinutes: 60,
    fiveKmTimeSeconds: 1800
  };

  const races = [
    { id: 'r1', date: '2026-05-01', distance: 'volkstriathlon', priority: 'B', goal: 'finish' },
    { id: 'r2', date: '2026-09-01', distance: 'olympic', priority: 'A', goal: 'pb' }
  ];

  const plan = generateSixMonthPlan(profile, races, '2026-03-24');

  assert.equal(plan.workouts.length, 182);
  assert.equal(plan.metadata.prioritizedRaceId, 'r1');
  assert.equal(plan.metadata.planStart, '2026-03-24');
  assert.equal(plan.metadata.planEnd, '2026-09-21');
  assert.ok(plan.workouts.some((w) => w.sport === 'rest'));
  assert.ok(plan.workouts.some((w) => w.why.includes('Woche')));
});
