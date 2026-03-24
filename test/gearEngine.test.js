import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeGear, summarizeGear } from '../src/engine/gearEngine.js';

test('analyzeGear computes status, wear, and recommendation', () => {
  const report = analyzeGear([
    { id: 'a', name: 'Daily', type: 'running_shoes', usageKm: 610, usageHours: 81, cost: 130 },
    { id: 'b', name: 'Chain', type: 'bike_chain', usageKm: 1200, usageHours: 70, cost: 40 }
  ]);

  assert.equal(report.length, 2);
  assert.equal(report[0].status, 'replace');
  assert.equal(report[1].status, 'ok');
  assert.ok(report[0].wearScore <= 1);
  assert.equal(typeof report[0].recommendation, 'string');
});

test('summarizeGear returns aggregate counts and highest risk items', () => {
  const report = analyzeGear([
    { id: 'a', name: 'Daily', type: 'running_shoes', usageKm: 590, usageHours: 70, cost: 130 },
    { id: 'b', name: 'Race', type: 'race_shoes', usageKm: 360, usageHours: 45, cost: 230 },
    { id: 'c', name: 'Chain', type: 'bike_chain', usageKm: 1000, usageHours: 40, cost: 40 }
  ]);

  const summary = summarizeGear(report);

  assert.equal(summary.total, 3);
  assert.ok(summary.warning + summary.ok + summary.replace === 3);
  assert.ok(summary.highestRisk.length >= 1);
});
