import { mondayOfIso, formatIsoDate } from "./dates";

/**
 * Wochenziele (rein/testbar). Vergleicht je Disziplin das Wochenziel (Minuten)
 * mit dem in der laufenden Woche tatsächlich absolvierten Volumen.
 */

export interface GoalDef {
  sport: string;
  weeklyTargetMin: number;
}

export interface GoalActivity {
  date: Date | string;
  sport: string;
  durationMin: number | null;
}

export interface GoalProgress {
  sport: string;
  targetMin: number;
  actualMin: number;
  pct: number;
}

export function buildGoalProgress(
  goals: GoalDef[],
  activities: GoalActivity[],
  today: Date = new Date(),
): GoalProgress[] {
  const weekMonday = mondayOfIso(today);
  const actualBySport = new Map<string, number>();
  for (const a of activities) {
    const day =
      typeof a.date === "string" ? a.date.slice(0, 10) : formatIsoDate(a.date);
    if (day < weekMonday) continue;
    actualBySport.set(a.sport, (actualBySport.get(a.sport) ?? 0) + (a.durationMin ?? 0));
  }

  return goals.map((g) => {
    const actualMin = Math.round(actualBySport.get(g.sport) ?? 0);
    const pct =
      g.weeklyTargetMin > 0
        ? Math.round((actualMin / g.weeklyTargetMin) * 100)
        : 0;
    return { sport: g.sport, targetMin: g.weeklyTargetMin, actualMin, pct };
  });
}
