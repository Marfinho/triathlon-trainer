import assert from 'node:assert/strict';
import test from 'node:test';

import { comparePlanVsImported, normalizeStravaActivities } from '../src/engine/stravaImportEngine.js';

test('normalizeStravaActivities maps Strava payload to internal format', () => {
  const normalized = normalizeStravaActivities([
    {
      id: 1,
      type: 'Run',
      start_date: '2026-03-24T10:00:00Z',
      moving_time: 2400,
      distance: 6500,
      average_heartrate: 151
    }
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].sport, 'run');
  assert.equal(normalized[0].durationMinutes, 40);
  assert.equal(normalized[0].zone, 3);
});

test('comparePlanVsImported returns compliance summary', () => {
  const imported = normalizeStravaActivities([
    { id: 1, type: 'Run', start_date: '2026-03-24T10:00:00Z', moving_time: 2400, distance: 6500 },
    { id: 2, type: 'Ride', start_date: '2026-03-25T10:00:00Z', moving_time: 3600, distance: 26000 }
  ]);

  const comparison = comparePlanVsImported(imported, [
    { id: 'p1', date: '2026-03-24', sport: 'run', durationMinutes: 42 },
    { id: 'p2', date: '2026-03-26', sport: 'bike', durationMinutes: 60 }
  ]);

  assert.equal(comparison.summary.importedCount, 2);
  assert.equal(comparison.summary.matchedCount, 1);
  assert.equal(comparison.summary.unmatchedCount, 1);
  assert.equal(comparison.summary.complianceRate, 50);
});

test('normalizeStravaActivities validates payload', () => {
  assert.throws(() => normalizeStravaActivities('bad'), /activities must be an array/);
  assert.throws(() => normalizeStravaActivities([{ type: 'Run' }]), /requires type and start_date/);
});
