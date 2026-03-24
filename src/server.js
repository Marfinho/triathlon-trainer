import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { adjustPlan, adjustPlanWithImpact } from './engine/adjustmentEngine.js';
import { createAdjustmentHistoryStore } from './engine/adjustmentHistoryStore.js';
import { buildDashboardSummary } from './engine/analyticsEngine.js';
import { buildFullDashboard } from './engine/dashboardAssembler.js';
import { evaluateRules } from './engine/ruleEngine.js';
import {
  buildScenarioProjection,
  buildUncertaintyBand,
  compareProjectionChange,
  inferZoneDistribution,
  projectCurrentFitness,
  projectPlannedTraining
} from './engine/forecastEngine.js';
import { analyzeGear, summarizeGear } from './engine/gearEngine.js';
import { generateSixMonthPlan } from './engine/planGenerator.js';
import { comparePlanVsImported, normalizeStravaActivities } from './engine/stravaImportEngine.js';
import { simulateRaceWithConditions } from './engine/weatherCourseEngine.js';
import { buildLoadMetrics } from './engine/loadModelEngine.js';
import { simulateRace, simulateRaceScenarios, simulateWhatIfImpact } from './engine/raceSimulationEngine.js';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT_DIR, '..', 'public');

const DRILLS = [
  {
    name: 'Catch-Up Drill',
    sport: 'swim',
    shortText: 'Ein Arm startet erst, wenn der andere vorne angekommen ist.',
    goal: 'Wasserlage, Zugkoordination, ruhiger Rhythmus.',
    mistakes: ['Zu langes Warten', 'Absinken der Beine'],
    sensation: 'Ruhiger Vortrieb und längere Wasserlage.',
    beginnerFriendly: true
  },
  {
    name: 'Kniehebelauf',
    sport: 'run',
    shortText: 'Kurze, kontrollierte Schritte mit aktivem Kniehub.',
    goal: 'Laufkoordination und Schrittmechanik.',
    mistakes: ['Zu große Schritte', 'Zu viel Spannung in den Schultern'],
    sensation: 'Aktiver Abdruck und stabiler Rumpf.',
    beginnerFriendly: true
  },
  {
    name: 'Einbeinige Trittübung',
    sport: 'bike',
    shortText: 'Fokus auf runden Tritt mit wenig Widerstand.',
    goal: 'Totpunkte reduzieren und Trittökonomie verbessern.',
    mistakes: ['Zu hoher Widerstand', 'Zu lange einseitig fahren'],
    sensation: 'Runder Pedalweg ohne Stottern.',
    beginnerFriendly: true
  }
];

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': contentType });
  res.end(text);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function assertRequired(obj, keys) {
  const missing = keys.filter((k) => obj?.[k] === undefined || obj?.[k] === null);
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(', ')}`);
}

function assertArrayField(obj, key) {
  if (!Array.isArray(obj?.[key])) {
    throw new Error(`${key} must be an array`);
  }
}

async function serveStatic(req, res) {
  const pathname = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(pathname).replace(/^\.+/, '');
  const fullPath = path.join(PUBLIC_DIR, safePath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'Forbidden');
    return true;
  }

  try {
    const data = await readFile(fullPath);
    if (fullPath.endsWith('.html')) return sendText(res, 200, data, 'text/html; charset=utf-8');
    if (fullPath.endsWith('.css')) return sendText(res, 200, data, 'text/css; charset=utf-8');
    if (fullPath.endsWith('.js')) return sendText(res, 200, data, 'application/javascript; charset=utf-8');
    return sendText(res, 200, data, 'application/octet-stream');
  } catch {
    sendText(res, 404, 'Not found');
  }
  return true;
}

async function route(req, res, context) {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const pathname = parsedUrl.pathname;
  if (req.method === 'GET' && (pathname === '/' || pathname.startsWith('/styles.css') || pathname.startsWith('/app.js'))) {
    return serveStatic(req, res);
  }

  if (req.method === 'GET' && pathname === '/health') {
    return sendJson(res, 200, { ok: true, version: 'v1' });
  }

  if (req.method === 'GET' && pathname === '/api/drills') {
    return sendJson(res, 200, { drills: DRILLS });
  }

  if (req.method === 'GET' && pathname === '/api/plan/adjustments') {
    const userId = parsedUrl.searchParams.get('userId') ?? undefined;
    const limitRaw = Number(parsedUrl.searchParams.get('limit') ?? 30);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.round(limitRaw))) : 30;
    return sendJson(res, 200, { entries: context.adjustmentStore.listByUser(userId, limit) });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 404, { error: 'Not found' });
  }

  const body = await parseJsonBody(req);

  if (pathname === '/api/plan/generate') {
    assertRequired(body, ['profile', 'races']);
    return sendJson(res, 200, generateSixMonthPlan(body.profile, body.races, body.startDate));
  }

  if (pathname === '/api/plan/adjust') {
    assertRequired(body, ['workouts', 'trigger']);
    return sendJson(res, 200, adjustPlan(body.workouts, body.trigger));
  }

  if (pathname === '/api/plan/adjust-with-impact') {
    assertRequired(body, ['workouts', 'trigger', 'baselineProjection']);
    assertArrayField(body, 'workouts');
    const result = adjustPlanWithImpact(body.workouts, body.trigger, body.baselineProjection);
    const userId = body.userId ?? 'anonymous';
    for (const entry of result.changelog) {
      context.adjustmentStore.add({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        recordedAt: new Date().toISOString(),
        ...entry,
        predictionDelta: result.predictionDelta
      });
    }
    return sendJson(res, 200, result);
  }


  if (pathname === '/api/forecast/current') {
    assertRequired(body, ['profile', 'completed']);
    return sendJson(res, 200, projectCurrentFitness(body.profile, body.completed));
  }

  if (pathname === '/api/forecast/planned') {
    assertRequired(body, ['current', 'input']);
    return sendJson(res, 200, projectPlannedTraining(body.current, body.input));
  }

  if (pathname === '/api/forecast/scenario') {
    assertRequired(body, ['planned']);
    return sendJson(res, 200, buildScenarioProjection(body.planned));
  }

  if (pathname === '/api/forecast/zones') {
    assertRequired(body, ['completed']);
    return sendJson(res, 200, inferZoneDistribution(body.completed));
  }




  if (pathname === '/api/forecast/uncertainty') {
    assertRequired(body, ['planned']);
    return sendJson(res, 200, buildUncertaintyBand(body.planned, body.meta));
  }

  if (pathname === '/api/forecast/delta') {
    assertRequired(body, ['previous', 'next']);
    return sendJson(res, 200, compareProjectionChange(body.previous, body.next));
  }

  if (pathname === '/api/dashboard/summary') {
    assertRequired(body, ['workouts']);
    assertArrayField(body, 'workouts');
    return sendJson(res, 200, buildDashboardSummary(body.workouts));
  }


  if (pathname === '/api/dashboard/full') {
    assertRequired(body, ['workouts']);
    assertArrayField(body, 'workouts');
    return sendJson(res, 200, buildFullDashboard(body.workouts, body.context, context.adjustmentStore));
  }

  if (pathname === '/api/load/metrics') {
    assertRequired(body, ['workouts']);
    assertArrayField(body, 'workouts');
    return sendJson(res, 200, buildLoadMetrics(body.workouts, body.config));
  }

  if (pathname === '/api/rules/evaluate') {
    assertRequired(body, ['workouts']);
    assertArrayField(body, 'workouts');
    return sendJson(res, 200, evaluateRules(body.workouts, body.context));
  }

  if (pathname === '/api/strava/import') {
    assertRequired(body, ['activities']);
    assertArrayField(body, 'activities');
    const imported = normalizeStravaActivities(body.activities);
    if (Array.isArray(body.plannedWorkouts)) {
      return sendJson(res, 200, {
        imported,
        comparison: comparePlanVsImported(imported, body.plannedWorkouts)
      });
    }
    return sendJson(res, 200, { imported });
  }


  if (pathname === '/api/gear/analyze') {
    assertRequired(body, ['items']);
    assertArrayField(body, 'items');
    const report = analyzeGear(body.items);
    return sendJson(res, 200, { report, summary: summarizeGear(report) });
  }

  if (pathname === '/api/simulate/race') {
    assertRequired(body, ['inputs']);
    return sendJson(res, 200, simulateRace(body.inputs, body.scenario));
  }


  if (pathname === '/api/simulate/race-scenarios') {
    assertRequired(body, ['inputs']);
    return sendJson(res, 200, simulateRaceScenarios(body.inputs, body.scenarios));
  }


  if (pathname === '/api/simulate/race-conditions') {
    assertRequired(body, ['inputs']);
    return sendJson(res, 200, simulateRaceWithConditions(body.inputs, body.scenario, body.conditions));
  }

  if (pathname === '/api/simulate/what-if') {
    assertRequired(body, ['baseline', 'whatIf']);
    return sendJson(res, 200, simulateWhatIfImpact(body.baseline, body.whatIf));
  }

  return sendJson(res, 404, { error: 'Not found' });
}

export function createServer() {
  const context = { adjustmentStore: createAdjustmentHistoryStore() };

  return http.createServer(async (req, res) => {
    try {
      await route(req, res, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      sendJson(res, 400, { error: message });
    }
  });
}

const entryPath = process.argv[1];
const thisPath = fileURLToPath(import.meta.url);

if (entryPath && thisPath === entryPath) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Triathlon Trainer API listening on :${port}`);
  });
}
