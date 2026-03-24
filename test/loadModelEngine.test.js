import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLoadMetrics } from '../src/engine/loadModelEngine.js';

test('buildLoadMetrics computes ctl/atl/form timeline and risk classification', () => {
  const workouts = [
    { date: '2026-03-01', durationMinutes: 45, zone: 2, status: 'done' },
    { date: '2026-03-02', durationMinutes: 60, zone: 3, status: 'done' },
    { date: '2026-03-03', durationMinutes: 75, zone: 4, status: 'done' },
    { date: '2026-03-05', durationMinutes: 90, zone: 4, status: 'done' },
    { date: '2026-03-07', durationMinutes: 120, zone: 5, status: 'done' }
  ];

  const result = buildLoadMetrics(workouts);

  assert.ok(result.timeline.length >= 7);
  assert.equal(typeof result.ctl, 'number');
  assert.equal(typeof result.atl, 'number');
  assert.equal(typeof result.form, 'number');
  assert.ok(['low', 'moderate', 'high'].includes(result.risk));
});

test('buildLoadMetrics returns empty baseline when no completed workouts are present', () => {
  const result = buildLoadMetrics([{ date: '2026-03-01', durationMinutes: 45, zone: 2, status: 'missed' }]);
  assert.equal(result.ctl, 0);
  assert.equal(result.timeline.length, 0);
  assert.equal(result.risk, 'low');
});

test('buildLoadMetrics validates input', () => {
  assert.throws(() => buildLoadMetrics('bad'), /workouts must be an array/);
  assert.throws(
    () => buildLoadMetrics([{ date: 'bad-date', durationMinutes: 40, zone: 2, status: 'done' }]),
    /Invalid workout date/
  );
});
