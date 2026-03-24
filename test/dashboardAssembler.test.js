import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdjustmentHistoryStore } from '../src/engine/adjustmentHistoryStore.js';
import { buildFullDashboard } from '../src/engine/dashboardAssembler.js';

test('buildFullDashboard combines summary/load/rules and adjustment history', () => {
  const workouts = [
    { date: '2026-03-24', sport: 'run', durationMinutes: 45, zone: 4, status: 'done', executedZone: 4 },
    { date: '2026-03-25', sport: 'bike', durationMinutes: 60, zone: 3, status: 'done' },
    { date: '2026-03-26', sport: 'run', durationMinutes: 35, zone: 2, status: 'done', executedZone: 3 }
  ];

  const store = createAdjustmentHistoryStore();
  store.add({ id: 'a1', userId: 'u1', reason: 'Ermüdungsmarker', impact: 'Deload', predictionDelta: { runTriPaceSecPerKm: 4 } });

  const dashboard = buildFullDashboard(
    workouts,
    { today: '2026-03-24', userId: 'u1', metrics: { bikeTrend: 0.04, runTrend: 0 } },
    store
  );

  assert.equal(typeof dashboard.summary.consistency, 'number');
  assert.ok(['low', 'moderate', 'high'].includes(dashboard.load.risk));
  assert.ok(Array.isArray(dashboard.rules.recommendations));
  assert.equal(dashboard.adjustments.length, 1);
});
