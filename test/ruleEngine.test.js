import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateRules } from '../src/engine/ruleEngine.js';

test('evaluateRules emits load/taper and trend recommendations with evidence', () => {
  const workouts = [
    { date: '2026-03-24', sport: 'run', zone: 4, status: 'done' },
    { date: '2026-03-23', sport: 'bike', zone: 4, status: 'done' },
    { date: '2026-03-22', sport: 'run', zone: 5, status: 'done' },
    { date: '2026-03-21', sport: 'swim', zone: 2, status: 'done' },
    { date: '2026-03-20', sport: 'run', zone: 2, executedZone: 3, status: 'done' },
    { date: '2026-03-19', sport: 'run', zone: 2, executedZone: 3, status: 'done' },
    { date: '2026-03-18', sport: 'run', zone: 2, executedZone: 2, status: 'done' },
    { date: '2026-03-25', sport: 'bike', zone: 4, status: 'planned' }
  ];

  const report = evaluateRules(workouts, {
    today: '2026-03-24',
    races: [{ id: 'race-a', date: '2026-04-01', priority: 'A' }],
    metrics: { bikeTrend: 0.05, runTrend: 0.0 }
  });

  assert.equal(report.rulesetVersion, 'v1.2.0');
  assert.equal(report.recommendationCount, 4);
  assert.match(report.summary, /Anpassungsbedarf/i);
  assert.deepEqual(
    report.recommendations.map((x) => x.ruleId).sort(),
    ['bike-up-run-flat', 'easy-runs-too-hard', 'hard-days-5-window', 'race-in-14-days']
  );
  assert.ok(report.recommendations.every((r) => typeof r.explanation === 'string' && r.explanation.length > 10));
});

test('evaluateRules prioritizes A-race over closer lower-priority race', () => {
  const workouts = [
    { date: '2026-03-24', sport: 'run', zone: 4, status: 'done' },
    { date: '2026-03-23', sport: 'run', zone: 4, status: 'planned' }
  ];

  const report = evaluateRules(workouts, {
    today: '2026-03-24',
    races: [
      { id: 'race-b-near', date: '2026-03-29', priority: 'B' },
      { id: 'race-a-main', date: '2026-04-04', priority: 'A' }
    ]
  });

  const taperRule = report.recommendations.find((x) => x.ruleId === 'race-in-14-days');
  assert.equal(taperRule?.evidence.raceId, 'race-a-main');
  assert.equal(taperRule?.evidence.priority, 'A');
});

test('evaluateRules returns zero recommendations for stable training', () => {
  const workouts = [
    { date: '2026-03-24', sport: 'run', zone: 2, status: 'done', executedZone: 2 },
    { date: '2026-03-23', sport: 'bike', zone: 2, status: 'done' },
    { date: '2026-03-22', sport: 'swim', zone: 1, status: 'done' }
  ];

  const report = evaluateRules(workouts, {
    today: '2026-03-24',
    races: [{ id: 'race-b', date: '2026-06-24', priority: 'B' }],
    metrics: { bikeTrend: 0.01, runTrend: 0.02 }
  });

  assert.equal(report.recommendationCount, 0);
  assert.match(report.summary, /Keine akuten Flags/i);
  assert.deepEqual(report.recommendations, []);
});

test('evaluateRules validates basic workout shape', () => {
  assert.throws(() => evaluateRules([{ sport: 'run', zone: 2 }]), /date is required/);
  assert.throws(() => evaluateRules('bad-input'), /workouts must be an array/);
  assert.throws(() => evaluateRules([{ date: '2026-03-24', sport: 'run', zone: '2' }]), /zone must be numeric/);
});
