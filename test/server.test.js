import test from 'node:test';
import assert from 'node:assert/strict';

import { createServer } from '../src/server.js';

async function postJson(base, path, payload) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return { status: res.status, body: await res.json() };
}

test('health endpoint, static page and plan generation endpoint respond', async () => {
  const server = createServer();

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);

  const home = await fetch(`${base}/`);
  const html = await home.text();
  assert.equal(home.status, 200);
  assert.match(html, /Triathlon Trainer v1/);

  const drills = await fetch(`${base}/api/drills`).then((r) => r.json());
  assert.ok(Array.isArray(drills.drills));
  assert.ok(drills.drills.length >= 3);

  const plan = await postJson(base, '/api/plan/generate', {
    profile: { id: 'u1', fitnessLevel: 'beginner', sessionsPerWeek: 4, maxSessionMinutes: 50 },
    races: [{ id: 'r1', date: '2026-08-01', distance: 'olympic', priority: 'A', goal: 'finish' }],
    startDate: '2026-03-24'
  });

  assert.equal(plan.status, 200);
  assert.equal(plan.body.workouts.length, 182);

  const badPlan = await postJson(base, '/api/plan/generate', { races: [] });
  assert.equal(badPlan.status, 400);

  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test('simulation and gear endpoints respond with expected payload', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  const race = await postJson(base, '/api/simulate/race', {
    inputs: {
      distance: 'volkstriathlon',
      swim: { pacePer100mSec: 150 },
      bike: { racePowerWatts: 160 },
      run: { triPaceSecPerKm: 360 }
    },
    scenario: 'realistic'
  });

  assert.equal(race.status, 200);
  assert.ok(race.body.splits.totalSeconds > 0);

  const impact = await postJson(base, '/api/simulate/what-if', {
    baseline: race.body,
    whatIf: { illnessWeeks: 2 }
  });

  const scenarioBundle = await postJson(base, '/api/simulate/race-scenarios', {
    inputs: {
      distance: 'volkstriathlon',
      swim: { pacePer100mSec: 150 },
      bike: { racePowerWatts: 160 },
      run: { triPaceSecPerKm: 360 }
    }
  });

  const conditionSimulation = await postJson(base, '/api/simulate/race-conditions', {
    inputs: {
      distance: 'volkstriathlon',
      swim: { pacePer100mSec: 150 },
      bike: { racePowerWatts: 160 },
      run: { triPaceSecPerKm: 360 }
    },
    scenario: 'realistic',
    conditions: { temperatureC: 27, windKph: 15, elevationGainM: 240, openWater: true, precipitation: 'light' }
  });

  assert.equal(scenarioBundle.status, 200);
  assert.ok(Array.isArray(scenarioBundle.body.scenarios));
  assert.ok(typeof scenarioBundle.body.recommendation.fastest.scenario === 'string');

  assert.equal(conditionSimulation.status, 200);
  assert.ok(conditionSimulation.body.corrected.deltaSeconds >= 0);

  assert.equal(impact.status, 200);
  assert.ok(typeof impact.body.deltaSeconds === 'number');


  const dashboard = await postJson(base, '/api/dashboard/summary', {
    workouts: [
      { date: '2026-03-24', sport: 'run', durationMinutes: 40, zone: 2, status: 'done' },
      { date: '2026-03-25', sport: 'bike', durationMinutes: 60, zone: 3, status: 'done' },
      { date: '2026-03-26', sport: 'swim', durationMinutes: 30, zone: 2, status: 'missed' }
    ]
  });

  assert.equal(dashboard.status, 200);
  assert.equal(typeof dashboard.body.consistency, 'number');

  const adjustWithImpact = await postJson(base, '/api/plan/adjust-with-impact', {
    workouts: [
      {
        id: 'w1',
        date: '2026-03-24',
        sport: 'run',
        durationMinutes: 60,
        zone: 4,
        details: ['hard'],
        goal: 'tempo',
        why: 'test',
        status: 'planned'
      }
    ],
    userId: 'u1',
    trigger: { fatigueFlag: true },
    baselineProjection: { runTriPaceSecPerKm: 355, bikeRacePowerWatts: 158, swimPacePer100mSec: 143 }
  });

  assert.equal(adjustWithImpact.status, 200);
  assert.equal(typeof adjustWithImpact.body.predictionDelta.runTriPaceSecPerKm, 'number');


  const adjustmentHistory = await fetch(`${base}/api/plan/adjustments?userId=u1&limit=5`).then((r) => r.json());
  assert.ok(Array.isArray(adjustmentHistory.entries));
  assert.ok(adjustmentHistory.entries.length >= 1);
  assert.equal(adjustmentHistory.entries[0].userId, 'u1');


  const fullDashboard = await postJson(base, '/api/dashboard/full', {
    workouts: [
      { date: '2026-03-24', sport: 'run', durationMinutes: 40, zone: 2, status: 'done', executedZone: 3 },
      { date: '2026-03-25', sport: 'bike', durationMinutes: 60, zone: 4, status: 'done' }
    ],
    context: {
      today: '2026-03-24',
      userId: 'u1',
      races: [{ id: 'r3', date: '2026-04-10', priority: 'A' }],
      metrics: { bikeTrend: 0.05, runTrend: 0 }
    }
  });

  assert.equal(fullDashboard.status, 200);
  assert.equal(typeof fullDashboard.body.summary.consistency, 'number');
  assert.ok(Array.isArray(fullDashboard.body.adjustments));


  const plannedProjection = await postJson(base, '/api/forecast/planned', {
    current: {
      swim: { pacePer100mSec: 145 },
      bike: { racePowerWatts: 150 },
      run: { triPaceSecPerKm: 360 }
    },
    input: { adherenceRate: 0.8, weeks: 6 }
  });

  assert.equal(plannedProjection.status, 200);

  const uncertainty = await postJson(base, '/api/forecast/uncertainty', {
    planned: plannedProjection.body,
    meta: { confidence: 72, weeksToRace: 10 }
  });

  assert.equal(uncertainty.status, 200);
  assert.ok(uncertainty.body.upper.runTriPaceSecPerKm > uncertainty.body.lower.runTriPaceSecPerKm);

  const projectionDelta = await postJson(base, '/api/forecast/delta', {
    previous: { ...plannedProjection.body, bikeRacePowerWatts: plannedProjection.body.bikeRacePowerWatts - 4 },
    next: plannedProjection.body
  });

  assert.equal(projectionDelta.status, 200);
  assert.equal(projectionDelta.body.delta.bikeRacePowerWatts, 4);


  const load = await postJson(base, '/api/load/metrics', {
    workouts: [
      { date: '2026-03-24', sport: 'run', durationMinutes: 40, zone: 2, status: 'done' },
      { date: '2026-03-25', sport: 'bike', durationMinutes: 70, zone: 4, status: 'done' },
      { date: '2026-03-26', sport: 'swim', durationMinutes: 30, zone: 2, status: 'done' }
    ]
  });

  assert.equal(load.status, 200);
  assert.ok(['low', 'moderate', 'high'].includes(load.body.risk));


  const rules = await postJson(base, '/api/rules/evaluate', {
    workouts: [
      { date: '2026-03-24', sport: 'run', zone: 4, status: 'done' },
      { date: '2026-03-23', sport: 'bike', zone: 4, status: 'done' },
      { date: '2026-03-22', sport: 'run', zone: 5, status: 'done' },
      { date: '2026-03-25', sport: 'run', zone: 4, status: 'planned' }
    ],
    context: {
      today: '2026-03-24',
      races: [{ id: 'r2', date: '2026-03-31', priority: 'A' }],
      metrics: { bikeTrend: 0.05, runTrend: 0 }
    }
  });

  assert.equal(rules.status, 200);
  assert.ok(rules.body.recommendationCount >= 1);



  const strava = await postJson(base, '/api/strava/import', {
    activities: [
      {
        id: 99,
        type: 'Run',
        start_date: '2026-03-24T10:00:00Z',
        moving_time: 2400,
        distance: 6500,
        average_heartrate: 150
      }
    ],
    plannedWorkouts: [{ id: 'p1', date: '2026-03-24', sport: 'run', durationMinutes: 42 }]
  });

  assert.equal(strava.status, 200);
  assert.equal(strava.body.comparison.summary.matchedCount, 1);


  const invalidRules = await postJson(base, '/api/rules/evaluate', {
    workouts: { date: '2026-03-24', sport: 'run', zone: 2 }
  });

  assert.equal(invalidRules.status, 400);
  assert.match(invalidRules.body.error, /workouts must be an array/);

  const gear = await postJson(base, '/api/gear/analyze', {
    items: [
      { id: 'g1', name: 'Daily', type: 'running_shoes', usageKm: 590, usageHours: 70, cost: 120 },
      { id: 'g2', name: 'Race', type: 'race_shoes', usageKm: 370, usageHours: 44, cost: 220 }
    ]
  });

  assert.equal(gear.status, 200);
  assert.ok(Array.isArray(gear.body.report));
  assert.equal(typeof gear.body.summary.total, 'number');

  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});
