import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDashboardSummary } from '../src/engine/analyticsEngine.js';

test('buildDashboardSummary aggregates weekly load and zone split', () => {
  const workouts = [
    { date: '2026-03-24', sport: 'run', durationMinutes: 40, zone: 2, status: 'done' },
    { date: '2026-03-25', sport: 'bike', durationMinutes: 60, zone: 3, status: 'done' },
    { date: '2026-03-26', sport: 'swim', durationMinutes: 35, zone: 2, status: 'missed' },
    { date: '2026-03-29', sport: 'run', durationMinutes: 50, zone: 4, status: 'planned' }
  ];

  const summary = buildDashboardSummary(workouts);

  assert.ok(Array.isArray(summary.weeks));
  assert.ok(summary.weeks.length >= 1);
  assert.equal(typeof summary.consistency, 'number');
  assert.equal(summary.statusCounts.done, 2);
  assert.ok(summary.zoneDistribution.easy >= 0);
});
