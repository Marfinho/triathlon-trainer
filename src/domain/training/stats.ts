import { formatIsoDate, addDays, mondayOfIso } from "./dates";

/**
 * Saison-Statistik & Bestwerte (rein/testbar). Aggregiert Ist-Aktivitäten zu
 * Eckdaten je Disziplin sowie Gesamtwerten, längster Aktivität, weitester
 * Distanz, höchster Einzel-Belastung, größter Trainingswoche und aktueller
 * Trainings-Streak (aufeinanderfolgende Tage mit mind. einer Einheit).
 */

export interface StatActivity {
  date: Date | string;
  sport: string;
  durationMin: number | null;
  distanceKm: number | null;
  load: number | null;
}

export interface SportBest {
  sport: string;
  sessions: number;
  totalMin: number;
  totalKm: number;
  longestMin: number;
  farthestKm: number;
  highestLoad: number;
}

export interface SeasonStats {
  bySport: SportBest[];
  totalSessions: number;
  totalHours: number;
  totalKm: number;
  biggestWeekLoad: number;
  biggestWeekStart: string | null;
  currentStreakDays: number;
  /** Wochen mit mindestens einer Einheit. */
  activeWeeks: number;
  /** Durchschnittliche Trainingsstunden über die aktiven Wochen. */
  avgWeeklyHours: number;
}

function iso(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : formatIsoDate(value);
}

export function buildSeasonStats(
  activities: StatActivity[],
  opts: { today?: Date } = {},
): SeasonStats {
  const today = opts.today ?? new Date();

  const bySportMap = new Map<string, SportBest>();
  const loadByWeek = new Map<string, number>();
  const daysWithActivity = new Set<string>();

  let totalMin = 0;
  let totalKm = 0;

  for (const a of activities) {
    const min = a.durationMin ?? 0;
    const km = a.distanceKm ?? 0;
    const load = a.load ?? 0;
    totalMin += min;
    totalKm += km;
    daysWithActivity.add(iso(a.date));

    const wk = mondayOfIso(a.date);
    loadByWeek.set(wk, (loadByWeek.get(wk) ?? 0) + load);

    const s =
      bySportMap.get(a.sport) ??
      bySportMap
        .set(a.sport, {
          sport: a.sport,
          sessions: 0,
          totalMin: 0,
          totalKm: 0,
          longestMin: 0,
          farthestKm: 0,
          highestLoad: 0,
        })
        .get(a.sport)!;
    s.sessions += 1;
    s.totalMin += min;
    s.totalKm += km;
    s.longestMin = Math.max(s.longestMin, min);
    s.farthestKm = Math.max(s.farthestKm, km);
    s.highestLoad = Math.max(s.highestLoad, load);
  }

  // Aktueller Streak ab heute rückwärts.
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const day = formatIsoDate(addDays(today, -i));
    if (daysWithActivity.has(day)) streak += 1;
    else if (i === 0) continue; // heute zählt nicht als Abbruch, wenn noch nichts
    else break;
  }

  const weeksWithActivity = new Set<string>();
  for (const a of activities) weeksWithActivity.add(mondayOfIso(a.date));
  const activeWeeks = weeksWithActivity.size;
  const totalHours = Math.round((totalMin / 60) * 10) / 10;
  const avgWeeklyHours =
    activeWeeks > 0 ? Math.round((totalHours / activeWeeks) * 10) / 10 : 0;

  const bySport = [...bySportMap.values()]
    .map((s) => ({
      ...s,
      totalMin: Math.round(s.totalMin),
      totalKm: Math.round(s.totalKm * 10) / 10,
      longestMin: Math.round(s.longestMin),
      farthestKm: Math.round(s.farthestKm * 10) / 10,
      highestLoad: Math.round(s.highestLoad),
    }))
    .sort((a, b) => b.totalMin - a.totalMin);

  let biggestWeekStart: string | null = null;
  let biggestWeekLoad = 0;
  for (const [week, load] of loadByWeek) {
    if (load > biggestWeekLoad) {
      biggestWeekLoad = load;
      biggestWeekStart = week;
    }
  }

  return {
    bySport,
    totalSessions: activities.length,
    totalHours,
    totalKm: Math.round(totalKm),
    biggestWeekLoad: Math.round(biggestWeekLoad),
    biggestWeekStart,
    currentStreakDays: streak,
    activeWeeks,
    avgWeeklyHours,
  };
}
