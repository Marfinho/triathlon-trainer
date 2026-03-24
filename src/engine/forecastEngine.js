function avg(numbers) {
  if (!numbers.length) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * @typedef CompletedSession
 * @property {'swim'|'bike'|'run'} sport
 * @property {number} durationMinutes
 * @property {number} zone
 * @property {number=} paceSecPerKm
 * @property {number=} watts
 */

/**
 * @param {CompletedSession[]} completed
 * @returns {{load: number, consistency: number, easyShare: number}}
 */
function trainingSignals(completed) {
  const load = completed.reduce((sum, s) => sum + s.durationMinutes * (0.6 + 0.2 * s.zone), 0);
  const easy = completed.filter((s) => s.zone <= 2).length;
  const easyShare = completed.length ? easy / completed.length : 0;
  const consistency = Math.min(completed.length / 24, 1);
  return { load, consistency, easyShare };
}

/**
 * @param {{fiveKmTimeSeconds?: number, ftpWatts?: number}} profile
 * @param {CompletedSession[]} completed
 */
export function projectCurrentFitness(profile, completed) {
  const { load, consistency } = trainingSignals(completed);

  const runBase = profile.fiveKmTimeSeconds ?? 33 * 60;
  const runFactor = Math.max(0.9, 1 - (load / 100000) * 0.08);
  const runPaceSecPerKm = (runBase / 5) * runFactor * (1 + (1 - consistency) * 0.04);

  const bikeBase = profile.ftpWatts ?? 140;
  const bikeRacePower = bikeBase * (0.75 + consistency * 0.08);

  const swimPaceSecPer100m = 150 - consistency * 8;

  return {
    swim: {
      pacePer100mSec: Math.round(swimPaceSecPer100m),
      explanation: 'Abgeleitet aus Trainingskonstanz und konservativem Freiwasseraufschlag.'
    },
    bike: {
      racePowerWatts: Math.round(bikeRacePower),
      explanation: 'Race-Power als Anteil der geschätzten Schwellenleistung mit Sicherheitsfaktor für den Lauf.'
    },
    run: {
      triPaceSecPerKm: Math.round(runPaceSecPerKm * 1.05),
      thresholdPaceSecPerKm: Math.round(runPaceSecPerKm),
      explanation: 'Triathlon-Laufpace leicht langsamer wegen Vorermüdung nach dem Radblock.'
    },
    confidence: Math.round((0.45 + consistency * 0.45) * 100)
  };
}

/**
 * @param {ReturnType<typeof projectCurrentFitness>} current
 * @param {{adherenceRate: number, weeks: number}} input
 */
export function projectPlannedTraining(current, input) {
  const adherence = Math.max(0, Math.min(input.adherenceRate, 1));
  const weeks = Math.max(1, input.weeks);
  const gain = Math.min(0.12, adherence * weeks * 0.004);

  return {
    swimPacePer100mSec: Math.round(current.swim.pacePer100mSec * (1 - gain * 0.5)),
    bikeRacePowerWatts: Math.round(current.bike.racePowerWatts * (1 + gain)),
    runTriPaceSecPerKm: Math.round(current.run.triPaceSecPerKm * (1 - gain * 0.6)),
    explanation:
      'Projektion basiert auf Planerfüllung, moderater Wochenadaption und einem konservativen Deckel für Leistungszuwachs.'
  };
}

/**
 * @param {ReturnType<typeof projectPlannedTraining>} planned
 */
export function buildScenarioProjection(planned) {
  return {
    conservative: {
      runTriPaceSecPerKm: planned.runTriPaceSecPerKm + 8,
      bikeRacePowerWatts: planned.bikeRacePowerWatts - 8,
      swimPacePer100mSec: planned.swimPacePer100mSec + 4
    },
    realistic: {
      runTriPaceSecPerKm: planned.runTriPaceSecPerKm,
      bikeRacePowerWatts: planned.bikeRacePowerWatts,
      swimPacePer100mSec: planned.swimPacePer100mSec
    },
    optimistic: {
      runTriPaceSecPerKm: planned.runTriPaceSecPerKm - 7,
      bikeRacePowerWatts: planned.bikeRacePowerWatts + 9,
      swimPacePer100mSec: planned.swimPacePer100mSec - 4
    }
  };
}

/**
 * @param {ReturnType<typeof projectPlannedTraining>} planned
 * @param {{confidence?: number, weeksToRace?: number}} [meta]
 */
export function buildUncertaintyBand(planned, meta = {}) {
  const confidence = Math.max(0.4, Math.min(0.95, (meta.confidence ?? 70) / 100));
  const weeks = Math.max(1, meta.weeksToRace ?? 8);
  const spreadFactor = Math.max(0.03, (1 - confidence) * (1 + weeks / 16));

  const swimSpread = Math.max(2, Math.round(planned.swimPacePer100mSec * spreadFactor * 0.4));
  const runSpread = Math.max(3, Math.round(planned.runTriPaceSecPerKm * spreadFactor * 0.35));
  const bikeSpread = Math.max(4, Math.round(planned.bikeRacePowerWatts * spreadFactor * 0.45));

  return {
    lower: {
      swimPacePer100mSec: planned.swimPacePer100mSec - swimSpread,
      bikeRacePowerWatts: planned.bikeRacePowerWatts + bikeSpread,
      runTriPaceSecPerKm: planned.runTriPaceSecPerKm - runSpread
    },
    expected: {
      swimPacePer100mSec: planned.swimPacePer100mSec,
      bikeRacePowerWatts: planned.bikeRacePowerWatts,
      runTriPaceSecPerKm: planned.runTriPaceSecPerKm
    },
    upper: {
      swimPacePer100mSec: planned.swimPacePer100mSec + swimSpread,
      bikeRacePowerWatts: Math.max(1, planned.bikeRacePowerWatts - bikeSpread),
      runTriPaceSecPerKm: planned.runTriPaceSecPerKm + runSpread
    },
    confidence: Math.round(confidence * 100),
    explanation: 'Unsicherheitskorridor kombiniert Modellvertrauen und Zeit bis zum Rennen.'
  };
}

/**
 * @param {ReturnType<typeof projectPlannedTraining>} previous
 * @param {ReturnType<typeof projectPlannedTraining>} next
 */
export function compareProjectionChange(previous, next) {
  const deltaSwimSec = next.swimPacePer100mSec - previous.swimPacePer100mSec;
  const deltaBikeWatts = next.bikeRacePowerWatts - previous.bikeRacePowerWatts;
  const deltaRunSec = next.runTriPaceSecPerKm - previous.runTriPaceSecPerKm;

  return {
    previous,
    next,
    delta: {
      swimPacePer100mSec: deltaSwimSec,
      bikeRacePowerWatts: deltaBikeWatts,
      runTriPaceSecPerKm: deltaRunSec
    },
    explanation:
      deltaBikeWatts >= 0 && deltaRunSec <= 0
        ? 'Neue Projektion zeigt insgesamt positive Entwicklung.'
        : 'Neue Projektion ist defensiver. Fokus auf Konsistenz und Erholung empfohlen.'
  };
}

/**
 * @param {CompletedSession[]} completed
 */
export function inferZoneDistribution(completed) {
  const total = completed.length || 1;
  const z1z2 = completed.filter((x) => x.zone <= 2).length;
  const z3 = completed.filter((x) => x.zone === 3).length;
  const z4z5 = completed.filter((x) => x.zone >= 4).length;

  return {
    easy: Number((z1z2 / total).toFixed(2)),
    moderate: Number((z3 / total).toFixed(2)),
    hard: Number((z4z5 / total).toFixed(2)),
    recommendation:
      z1z2 / total < 0.65
        ? 'Zu wenig locker trainiert. Reduziere harte Einheiten für bessere Verteilung (Ziel: ca. 70/20/10).'
        : 'Belastungsverteilung ist im sinnvollen Bereich.'
  };
}

export function summarizeRecentRunPace(completedRuns) {
  const paces = completedRuns.filter((r) => Number.isFinite(r.paceSecPerKm)).map((r) => r.paceSecPerKm);
  return Math.round(avg(paces));
}
