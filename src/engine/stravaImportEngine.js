const SPORT_MAP = {
  Run: 'run',
  Ride: 'bike',
  Swim: 'swim',
  VirtualRide: 'bike',
  Workout: 'strength'
};

function toIsoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid activity date: ${value}`);
  return date.toISOString().slice(0, 10);
}

function estimateZone(activity) {
  const hr = Number(activity.average_heartrate ?? 0);
  if (hr >= 175) return 5;
  if (hr >= 162) return 4;
  if (hr >= 150) return 3;
  if (hr >= 135) return 2;
  return 1;
}

/**
 * Normalize Strava activities into internal completed session shape.
 * @param {Array<{id:number,name?:string,type:string,start_date:string,moving_time:number,distance:number,average_heartrate?:number,average_watts?:number}>} activities
 */
export function normalizeStravaActivities(activities) {
  if (!Array.isArray(activities)) throw new Error('activities must be an array');

  return activities.map((a, idx) => {
    if (!a || typeof a !== 'object') throw new Error(`activities[${idx}] must be an object`);
    if (!a.type || !a.start_date) throw new Error(`activities[${idx}] requires type and start_date`);

    const sport = SPORT_MAP[a.type] ?? 'run';
    const durationMinutes = Math.max(1, Math.round(Number(a.moving_time ?? 0) / 60));

    return {
      externalId: String(a.id ?? `strava-${idx}`),
      date: toIsoDate(a.start_date),
      sport,
      durationMinutes,
      distanceKm: Number((Number(a.distance ?? 0) / 1000).toFixed(2)),
      zone: estimateZone(a),
      watts: Number.isFinite(a.average_watts) ? Math.round(Number(a.average_watts)) : undefined,
      source: 'strava'
    };
  });
}

/**
 * Match imported activities against planned workouts by date + sport.
 * @param {ReturnType<typeof normalizeStravaActivities>} imported
 * @param {Array<{id:string,date:string,sport:string,durationMinutes:number}>} planned
 */
export function comparePlanVsImported(imported, planned) {
  const plannedByKey = new Map(planned.map((w) => [`${w.date}::${w.sport}`, w]));

  const matched = [];
  const unmatched = [];

  for (const item of imported) {
    const key = `${item.date}::${item.sport}`;
    const plannedWorkout = plannedByKey.get(key);

    if (!plannedWorkout) {
      unmatched.push(item);
      continue;
    }

    const durationDelta = item.durationMinutes - plannedWorkout.durationMinutes;

    matched.push({
      imported: item,
      planned: plannedWorkout,
      durationDelta,
      intensityMatch: Math.abs(durationDelta) <= 15
    });
  }

  return {
    matched,
    unmatched,
    summary: {
      importedCount: imported.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      complianceRate: imported.length ? Number(((matched.length / imported.length) * 100).toFixed(1)) : 0
    }
  };
}
