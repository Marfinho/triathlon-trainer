function formatPace(secPerKm) {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, '0')} /km`;
}

function format100m(sec) {
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}:${String(rem).padStart(2, '0')} /100m`;
}

function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || 'Request failed');
  }
  return res.json();
}

function renderForecast(current, planned) {
  const node = document.querySelector('#forecast');
  node.innerHTML = `
    <p><strong>Swim:</strong> ${format100m(current.swim.pacePer100mSec)} → geplant ${format100m(planned.swimPacePer100mSec)}</p>
    <p><strong>Bike:</strong> ${current.bike.racePowerWatts} W → geplant ${planned.bikeRacePowerWatts} W</p>
    <p><strong>Run:</strong> ${formatPace(current.run.triPaceSecPerKm)} → geplant ${formatPace(planned.runTriPaceSecPerKm)}</p>
    <p><strong>Confidence:</strong> ${current.confidence}%</p>
    <p class="hint">${planned.explanation}</p>
  `;
}

function renderForecastBand(band, delta) {
  const node = document.querySelector('#forecast-band');
  node.innerHTML = `
    <p><strong>Confidence:</strong> ${band.confidence}%</p>
    <p>Run: ${band.lower.runTriPaceSecPerKm}s/km → ${band.upper.runTriPaceSecPerKm}s/km</p>
    <p>Bike: ${band.upper.bikeRacePowerWatts}W → ${band.lower.bikeRacePowerWatts}W</p>
    <p>Swim: ${band.lower.swimPacePer100mSec}s/100m → ${band.upper.swimPacePer100mSec}s/100m</p>
    <p>${band.explanation}</p>
    <p><strong>Planänderung Δ:</strong> Run ${delta.delta.runTriPaceSecPerKm}s/km, Bike ${delta.delta.bikeRacePowerWatts}W, Swim ${delta.delta.swimPacePer100mSec}s/100m</p>
    <p>${delta.explanation}</p>
  `;
}

function renderScenarioComparison(bundle) {
  const node = document.querySelector('#simulation-scenarios');
  node.innerHTML = `
    <p><strong>Fastest:</strong> ${bundle.recommendation.fastest.scenario} (${bundle.recommendation.fastest.totalSeconds}s)</p>
    <p><strong>Safest:</strong> ${bundle.recommendation.safest.scenario} (${bundle.recommendation.safest.totalSeconds}s)</p>
    <ul>
      ${bundle.scenarios.map((s) => `<li>${s.scenario}: ${s.splits.totalSeconds}s, Warnungen: ${s.warnings.length}</li>`).join('')}
    </ul>
  `;
}

function renderConditionSimulation(result) {
  const node = document.querySelector('#simulation-conditions');
  node.innerHTML = `
    <p><strong>Weather/Course Δ:</strong> ${result.corrected.deltaSeconds}s</p>
    <p>Baseline: ${result.baseline.splits.totalSeconds}s → Corrected: ${result.corrected.splits.totalSeconds}s</p>
    <p>${result.corrected.explanation}</p>
  `;
}

function renderSimulation(sim) {
  const node = document.querySelector('#simulation');
  node.innerHTML = `
    <p><strong>Zielzeit:</strong> ${formatTime(sim.splits.totalSeconds)}</p>
    <p>Swim: ${formatTime(sim.splits.swimSeconds)} | Bike: ${formatTime(sim.splits.bikeSeconds)} | Run: ${formatTime(sim.splits.runSeconds)}</p>
    <p>T1: ${sim.splits.t1Sec}s, T2: ${sim.splits.t2Sec}s</p>
    <p>Pacing: ${sim.pacing.bikePowerWatts}W, ${formatPace(sim.pacing.runPaceSecPerKm)}</p>
    <p>${sim.explanation}</p>
    ${sim.warnings.map((w) => `<p>⚠️ ${w}</p>`).join('')}
  `;
}


function renderRules(report) {
  const node = document.querySelector('#rules');

  const items = report.recommendations
    .map((r) => {
      const evidence = Object.entries(r.evidence ?? {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      return `<li><strong>${r.action}</strong> [${r.severity}] – ${r.explanation}<br /><small>Evidenz: ${evidence || 'n/a'}</small></li>`;
    })
    .join('');

  node.innerHTML = `
    <p><strong>Regelwerk:</strong> ${report.rulesetVersion} (${report.recommendationCount} Hinweise)</p>
    <p>${report.summary}</p>
    ${report.recommendationCount ? `<ul>${items}</ul>` : ''}
  `;
}

function renderAdjustmentImpact(result) {
  const node = document.querySelector('#adjustment-impact');
  node.innerHTML = `
    <p>${result.impactSummary}</p>
    <p><strong>Forecast Δ:</strong> Run ${result.predictionDelta.runTriPaceSecPerKm}s/km, Bike ${result.predictionDelta.bikeRacePowerWatts}W, Swim ${result.predictionDelta.swimPacePer100mSec}s/100m</p>
    <p><strong>Changelog:</strong> ${result.changelog.length} Anpassungen</p>
  `;
}

function renderAdjustmentHistory(history) {
  const node = document.querySelector('#adjustment-history');
  if (!history.entries.length) {
    node.innerHTML = '<p>Noch keine gespeicherten Anpassungen.</p>';
    return;
  }

  node.innerHTML = `
    <ul>
      ${history.entries
        .map((e) => `<li>${e.recordedAt.slice(0, 10)} – ${e.reason} (${e.impact}) [RunΔ ${e.predictionDelta.runTriPaceSecPerKm}s/km]</li>`)
        .join('')}
    </ul>
  `;
}

function renderLoadMetrics(metrics) {
  const node = document.querySelector('#load-metrics');
  node.innerHTML = `
    <p><strong>CTL:</strong> ${metrics.ctl.toFixed(1)} | <strong>ATL:</strong> ${metrics.atl.toFixed(1)} | <strong>Form:</strong> ${metrics.form.toFixed(1)}</p>
    <p><strong>Ramp Rate:</strong> ${metrics.rampRate}% | <strong>7d Load:</strong> ${metrics.acuteLoad7d} | <strong>Risk:</strong> ${metrics.risk}</p>
    <p>${metrics.explanation}</p>
  `;
}

function renderDashboard(summary) {
  const node = document.querySelector('#dashboard');
  const latestWeek = summary.weeks[summary.weeks.length - 1];
  node.innerHTML = `
    <p><strong>Konsistenz:</strong> ${summary.consistency}%</p>
    <p><strong>Zonen:</strong> Locker ${summary.zoneDistribution.easy}% | Moderat ${summary.zoneDistribution.moderate}% | Hart ${summary.zoneDistribution.hard}%</p>
    <p><strong>Aktuelle Woche:</strong> ${latestWeek?.week ?? '-'} (${latestWeek?.totalMinutes ?? 0} min)</p>
    <p>${summary.explanation}</p>
  `;
}

function renderPlan(workouts) {
  const tbody = document.querySelector('#plan-table');
  tbody.innerHTML = workouts
    .slice(0, 14)
    .map(
      (w) => `
      <tr>
        <td>${w.date}</td>
        <td><span class="badge">${w.sport}</span></td>
        <td>${w.durationMinutes} min</td>
        <td>Z${w.zone}</td>
        <td>${w.goal}</td>
        <td>${w.why}</td>
      </tr>`
    )
    .join('');
}

async function renderDrills() {
  const data = await fetch('/api/drills').then((r) => r.json());
  const list = document.querySelector('#drills');
  list.innerHTML = data.drills
    .map(
      (d) =>
        `<li title="Fehler: ${d.mistakes.join(', ')}\nGefühl: ${d.sensation}"><strong>${d.name}</strong> (${d.sport}) – ${d.shortText} <em>Ziel:</em> ${d.goal}</li>`
    )
    .join('');
}


async function renderStravaImport() {
  const sampleActivities = [
    {
      id: 101,
      type: 'Run',
      start_date: new Date().toISOString(),
      moving_time: 42 * 60,
      distance: 7800,
      average_heartrate: 152
    },
    {
      id: 102,
      type: 'Ride',
      start_date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      moving_time: 75 * 60,
      distance: 29000,
      average_heartrate: 148,
      average_watts: 168
    }
  ];

  const plannedWorkouts = [
    { id: 'p1', date: new Date().toISOString().slice(0, 10), sport: 'run', durationMinutes: 40 },
    { id: 'p2', date: new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10), sport: 'bike', durationMinutes: 70 }
  ];

  const data = await post('/api/strava/import', { activities: sampleActivities, plannedWorkouts });
  const node = document.querySelector('#strava-report');
  node.innerHTML = `
    <p><strong>Importiert:</strong> ${data.comparison.summary.importedCount} | <strong>Gematcht:</strong> ${data.comparison.summary.matchedCount} | <strong>Compliance:</strong> ${data.comparison.summary.complianceRate}%</p>
    <ul>
      ${data.comparison.matched
        .map((m) => `<li>${m.imported.date} ${m.imported.sport}: Δ ${m.durationDelta} min (${m.intensityMatch ? 'ok' : 'abweichend'})</li>`)
        .join('')}
    </ul>
  `;
}

async function renderGearReport() {
  const sampleItems = [
    { id: 'g1', name: 'Daily Trainer', type: 'running_shoes', usageKm: 540, usageHours: 65, cost: 140 },
    { id: 'g2', name: 'Race Shoe', type: 'race_shoes', usageKm: 310, usageHours: 30, cost: 240 },
    { id: 'g3', name: 'Bike Chain', type: 'bike_chain', usageKm: 3600, usageHours: 185, cost: 45 }
  ];

  const data = await post('/api/gear/analyze', { items: sampleItems });
  const node = document.querySelector('#gear-report');
  node.innerHTML = `
    <p><strong>OK:</strong> ${data.summary.ok} | <strong>Warnung:</strong> ${data.summary.warning} | <strong>Tausch:</strong> ${data.summary.replace}</p>
    <ul>
      ${data.report
        .map(
          (item) =>
            `<li><strong>${item.name}</strong> (${item.type}) – Status: ${item.status}, Rest: ${item.remainingKm} km / ${item.remainingHours} h. ${item.recommendation}</li>`
        )
        .join('')}
    </ul>
  `;
}

async function buildV1() {
  const sessionsPerWeek = Number(document.querySelector('#sessions').value);
  const maxSessionMinutes = Number(document.querySelector('#maxMinutes').value);
  const fiveKmTimeSeconds = Number(document.querySelector('#fiveKm').value);
  const ftpWatts = Number(document.querySelector('#ftp').value);
  const distance = document.querySelector('#distance').value;

  const today = new Date().toISOString().slice(0, 10);
  const raceDate = new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const profile = {
    id: 'demo-user',
    fitnessLevel: 'beginner',
    sessionsPerWeek,
    maxSessionMinutes,
    fiveKmTimeSeconds,
    ftpWatts
  };

  const races = [{ id: 'main-race', date: raceDate, distance, priority: 'A', goal: 'finish' }];

  const plan = await post('/api/plan/generate', { profile, races, startDate: today });
  renderPlan(plan.workouts);

  const dashboardInput = plan.workouts.slice(0, 28).map((w, idx) => ({
    ...w,
    status: idx % 7 === 0 ? 'missed' : idx % 5 === 0 ? 'planned' : 'done'
  }));
  const adjustmentImpact = await post('/api/plan/adjust-with-impact', {
    userId: profile.id,
    workouts: plan.workouts.slice(0, 14),
    trigger: { tooHardRunCount: 3, fatigueFlag: true },
    baselineProjection: {
      runTriPaceSecPerKm: 355,
      bikeRacePowerWatts: 158,
      swimPacePer100mSec: 143
    }
  });
  renderAdjustmentImpact(adjustmentImpact);

  const ruleWorkouts = dashboardInput.map((w) => ({
    ...w,
    executedZone: w.sport === 'run' && w.zone <= 2 ? w.zone + 1 : w.zone
  }));

  const fullDashboard = await post('/api/dashboard/full', {
    workouts: ruleWorkouts,
    context: {
      today,
      userId: profile.id,
      races,
      metrics: { bikeTrend: 0.04, runTrend: 0.0 }
    }
  });

  renderDashboard(fullDashboard.summary);
  renderLoadMetrics(fullDashboard.load);
  renderRules(fullDashboard.rules);
  renderAdjustmentHistory({ entries: fullDashboard.adjustments });

  const completed = plan.workouts
    .slice(0, 24)
    .filter((w) => w.sport !== 'rest')
    .map((w) => ({
      sport: w.sport === 'strength' ? 'run' : w.sport,
      durationMinutes: w.durationMinutes || 30,
      zone: w.zone,
      paceSecPerKm: w.sport === 'run' ? Math.max(320, fiveKmTimeSeconds / 5 + 20) : undefined,
      watts: w.sport === 'bike' ? ftpWatts * 0.76 : undefined
    }));

  const current = await post('/api/forecast/current', { profile, completed });
  const planned = await post('/api/forecast/planned', { current, input: { adherenceRate: 0.82, weeks: 6 } });
  renderForecast(current, planned);

  const alternativePlan = await post('/api/forecast/planned', { current, input: { adherenceRate: 0.65, weeks: 6 } });
  const forecastBand = await post('/api/forecast/uncertainty', { planned, meta: { confidence: current.confidence, weeksToRace: 10 } });
  const projectionDelta = await post('/api/forecast/delta', { previous: alternativePlan, next: planned });
  renderForecastBand(forecastBand, projectionDelta);

  const raceInputs = {
    distance,
    swim: { pacePer100mSec: current.swim.pacePer100mSec },
    bike: { racePowerWatts: current.bike.racePowerWatts },
    run: { triPaceSecPerKm: current.run.triPaceSecPerKm }
  };

  const simulation = await post('/api/simulate/race', {
    inputs: raceInputs,
    scenario: 'realistic'
  });

  const scenarioBundle = await post('/api/simulate/race-scenarios', {
    inputs: raceInputs
  });

  const conditionSimulation = await post('/api/simulate/race-conditions', {
    inputs: raceInputs,
    scenario: 'realistic',
    conditions: {
      temperatureC: 26,
      windKph: 18,
      elevationGainM: 250,
      openWater: true,
      precipitation: 'light'
    }
  });

  renderSimulation(simulation);
  renderScenarioComparison(scenarioBundle);
  renderConditionSimulation(conditionSimulation);
}

document.querySelector('#onboarding-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await buildV1();
  } catch (error) {
    alert(`Fehler: ${error.message}`);
  }
});

buildV1();
renderDrills();


document.querySelector('#gear-check').addEventListener('click', async () => {
  try {
    await renderGearReport();
  } catch (error) {
    alert(`Fehler: ${error.message}`);
  }
});

renderGearReport();

document.querySelector('#strava-import').addEventListener('click', async () => {
  try {
    await renderStravaImport();
  } catch (error) {
    alert(`Fehler: ${error.message}`);
  }
});

renderStravaImport();
