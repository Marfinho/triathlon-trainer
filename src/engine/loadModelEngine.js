function toDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid workout date: ${dateStr}`);
  return date;
}

function dayDiff(a, b) {
  return Math.round((a.getTime() - b.getTime()) / (24 * 3600 * 1000));
}

function sortByDate(workouts) {
  return [...workouts].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
}

function computeSessionLoad(workout) {
  const duration = Math.max(0, Number(workout.durationMinutes ?? 0));
  const zone = Math.max(1, Math.min(5, Number(workout.zone ?? 1)));
  const intensityFactor = 0.55 + zone * 0.18;
  return Math.round(duration * intensityFactor);
}

/**
 * Calculates basic fatigue model signals based on CTL/ATL style smoothing.
 * @param {Array<{date:string,durationMinutes:number,zone:number,status?:'planned'|'done'|'missed'}>} workouts
 * @param {{ctlTimeConstant?:number,atlTimeConstant?:number}} [config]
 */
export function buildLoadMetrics(workouts, config = {}) {
  if (!Array.isArray(workouts)) throw new Error('workouts must be an array');

  const doneWorkouts = workouts.filter((w) => w.status !== 'missed');
  if (doneWorkouts.length === 0) {
    return {
      ctl: 0,
      atl: 0,
      form: 0,
      rampRate: 0,
      acuteLoad7d: 0,
      chronicLoad28d: 0,
      risk: 'low',
      explanation: 'Noch keine abgeschlossenen Einheiten. Starte mit konstantem Grundlagenaufbau.',
      timeline: []
    };
  }

  const ordered = sortByDate(doneWorkouts);
  const ctlTau = Math.max(7, config.ctlTimeConstant ?? 42);
  const atlTau = Math.max(3, config.atlTimeConstant ?? 7);

  let ctl = 0;
  let atl = 0;
  let cursorDate = toDate(ordered[0].date);
  let pointer = 0;

  const timeline = [];

  while (pointer < ordered.length) {
    const day = cursorDate.toISOString().slice(0, 10);
    const sameDay = [];

    while (pointer < ordered.length && ordered[pointer].date === day) {
      sameDay.push(ordered[pointer]);
      pointer += 1;
    }

    const dayLoad = sameDay.reduce((sum, w) => sum + computeSessionLoad(w), 0);

    ctl = ctl + (dayLoad - ctl) * (1 / ctlTau);
    atl = atl + (dayLoad - atl) * (1 / atlTau);

    timeline.push({ date: day, dayLoad, ctl: Number(ctl.toFixed(2)), atl: Number(atl.toFixed(2)), form: Number((ctl - atl).toFixed(2)) });

    if (pointer < ordered.length) {
      const nextDate = toDate(ordered[pointer].date);
      const diff = Math.max(1, dayDiff(nextDate, cursorDate));

      for (let i = 1; i < diff; i += 1) {
        ctl = ctl + (0 - ctl) * (1 / ctlTau);
        atl = atl + (0 - atl) * (1 / atlTau);
        const gapDate = new Date(cursorDate);
        gapDate.setUTCDate(gapDate.getUTCDate() + i);
        timeline.push({
          date: gapDate.toISOString().slice(0, 10),
          dayLoad: 0,
          ctl: Number(ctl.toFixed(2)),
          atl: Number(atl.toFixed(2)),
          form: Number((ctl - atl).toFixed(2))
        });
      }

      cursorDate = nextDate;
    }
  }

  const end = timeline.length;
  const last7 = timeline.slice(Math.max(0, end - 7));
  const prev7 = timeline.slice(Math.max(0, end - 14), Math.max(0, end - 7));
  const last28 = timeline.slice(Math.max(0, end - 28));

  const acuteLoad7d = Number(last7.reduce((sum, x) => sum + x.dayLoad, 0).toFixed(2));
  const chronicLoad28d = Number((last28.reduce((sum, x) => sum + x.dayLoad, 0) / Math.max(1, last28.length)).toFixed(2));

  const currentWeekAvg = last7.length ? acuteLoad7d / last7.length : 0;
  const prevWeekAvg = prev7.length ? prev7.reduce((sum, x) => sum + x.dayLoad, 0) / prev7.length : currentWeekAvg;
  const rampRate = Number((((currentWeekAvg - prevWeekAvg) / Math.max(1, prevWeekAvg)) * 100).toFixed(1));

  const final = timeline[timeline.length - 1];
  const form = final?.form ?? 0;

  const risk = rampRate > 15 || form < -20 ? 'high' : rampRate > 8 || form < -10 ? 'moderate' : 'low';

  const explanation =
    risk === 'high'
      ? 'Hohe Laststeigerung oder starke Ermüdung erkannt. Deload/leichte Tage einplanen.'
      : risk === 'moderate'
        ? 'Belastung steigt spürbar. Erholung und Schlaf eng monitoren.'
        : 'Belastungsentwicklung ist stabil und im grünen Bereich.';

  return {
    ctl: final?.ctl ?? 0,
    atl: final?.atl ?? 0,
    form,
    rampRate,
    acuteLoad7d,
    chronicLoad28d,
    risk,
    explanation,
    timeline
  };
}
