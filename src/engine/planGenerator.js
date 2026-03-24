import { ZONE_LABELS } from '../types.js';

const SPORTS_CYCLE = ['swim', 'bike', 'run', 'strength', 'bike', 'run', 'rest'];
const PHASES = ['base', 'build', 'peak', 'taper'];

function addDays(date, days) {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function phaseForDay(dayIndex) {
  const week = Math.floor(dayIndex / 7);
  if (week < 8) return PHASES[0];
  if (week < 18) return PHASES[1];
  if (week < 23) return PHASES[2];
  return PHASES[3];
}

function zoneForPhase(phase, sport, isLongSession) {
  if (sport === 'rest') return 1;
  if (phase === 'base') return isLongSession ? 2 : 1;
  if (phase === 'build') return isLongSession ? 3 : 2;
  if (phase === 'peak') return isLongSession ? 4 : 2;
  return 1;
}

function safeSessionsPerWeek(profile) {
  return Math.max(3, Math.min(profile.sessionsPerWeek, 6));
}

function shouldTrainOnDay(dayOfWeek, sessionsPerWeek) {
  if (dayOfWeek === 0) return false;
  return dayOfWeek <= sessionsPerWeek;
}

function computeDurationMinutes(dayIndex, profile) {
  const week = Math.floor(dayIndex / 7);
  const progressiveCap = 1 + Math.min(week * 0.1, 0.8);
  return Math.round(Math.min(profile.maxSessionMinutes * progressiveCap, profile.maxSessionMinutes * 1.8));
}

function workoutGoalFor(sport, phase) {
  if (sport === 'swim') return phase === 'base' ? 'Wasserlage und Rhythmus' : 'Technik unter Belastung';
  if (sport === 'bike') return phase === 'peak' ? 'Rennspezifische Race-Power' : 'Aerobe Grundlage';
  if (sport === 'run') return phase === 'taper' ? 'Frische mit kurzer Aktivierung' : 'Laufökonomie und Stabilität';
  if (sport === 'strength') return 'Verletzungsprophylaxe und Stabilität';
  return 'Regeneration';
}

function workoutDetailsFor(sport, zone, phase, duration) {
  if (sport === 'rest') return ['Ruhetag', 'Optional 15 min Mobility'];
  const common = [`${duration} min in Zone ${zone} (${ZONE_LABELS[zone]})`];
  if (sport === 'swim') return [...common, '6×50m Technikdrills (Catch-Up / Kraulbeine)'];
  if (sport === 'bike') return [...common, phase === 'peak' ? '3×8 min race-spezifisch' : 'Kadenzfokus 90+'];
  if (sport === 'run') return [...common, phase === 'build' ? '5×3 min zügig, dazwischen locker' : 'Lauf-ABC 10 min'];
  return [...common, 'Core: 3×8 (Plank, Side-Plank, Hip-Hinge)'];
}

function whyText(phase, sport, dayIndex) {
  const week = Math.floor(dayIndex / 7) + 1;
  if (sport === 'rest') return `Woche ${week}: Geplante Erholung, damit Anpassung stattfinden kann.`;
  return `Woche ${week} (${phase}): Diese ${sport}-Einheit stabilisiert den Block, ohne die Belastungsverteilung zu kippen.`;
}

/**
 * Generate a rolling six-month (26-week) plan.
 * @param {import('../types.js').UserProfile} profile
 * @param {import('../types.js').Race[]} races
 * @param {string=} startDate ISO date
 * @returns {{workouts: import('../types.js').Workout[], metadata: {planStart: string, planEnd: string, prioritizedRaceId: string|null}}}
 */
export function generateSixMonthPlan(profile, races, startDate = new Date().toISOString().slice(0, 10)) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const sessionsPerWeek = safeSessionsPerWeek(profile);
  const days = 26 * 7;

  const prioritizedRace = [...races]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .find((race) => new Date(race.date).getTime() >= start.getTime()) || null;

  const workouts = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const date = addDays(start, dayIndex);
    const dayOfWeek = date.getUTCDay();
    const phase = phaseForDay(dayIndex);
    const cycleSport = SPORTS_CYCLE[dayIndex % SPORTS_CYCLE.length];
    const trainingDay = shouldTrainOnDay(dayOfWeek, sessionsPerWeek);
    const sport = trainingDay ? cycleSport : 'rest';
    const duration = sport === 'rest' ? 0 : computeDurationMinutes(dayIndex, profile);
    const longSession = dayOfWeek === 6;
    const zone = zoneForPhase(phase, sport, longSession);

    workouts.push({
      id: `w-${dayIndex + 1}`,
      date: toIsoDate(date),
      sport,
      durationMinutes: duration,
      zone,
      details: workoutDetailsFor(sport, zone, phase, duration),
      goal: workoutGoalFor(sport, phase),
      why: whyText(phase, sport, dayIndex),
      status: 'planned'
    });
  }

  return {
    workouts,
    metadata: {
      planStart: toIsoDate(start),
      planEnd: toIsoDate(addDays(start, days - 1)),
      prioritizedRaceId: prioritizedRace?.id ?? null
    }
  };
}
