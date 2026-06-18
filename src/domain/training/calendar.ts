import { formatIsoDate, addDays, mondayOfIso, parseIsoDate } from "./dates";

/**
 * Trainingskalender (rein/testbar). Baut ein Wochengitter (Mo–So) und ordnet je
 * Tag geplante Workouts und Ist-Aktivitäten zu – inklusive Detailfelder für eine
 * Tages-Detailansicht (Modal).
 */

export interface CalendarPlanned {
  date: Date | string;
  sport: string;
  title: string;
  plannedDurationMin: number;
  status: string;
  plannedDistanceM?: number | null;
  rpe?: number | null;
  description?: string | null;
}

export interface CalendarActual {
  date: Date | string;
  sport: string;
  durationMin: number | null;
  distanceKm?: number | null;
  load?: number | null;
  rpe?: number | null;
  avgHr?: number | null;
}

export interface CalendarItem {
  kind: "planned" | "actual";
  sport: string;
  label: string;
  durationMin: number;
  status?: string;
  distanceKm?: number | null;
  load?: number | null;
  rpe?: number | null;
  avgHr?: number | null;
  description?: string | null;
}

export interface CalendarDay {
  date: string;
  inPast: boolean;
  isToday: boolean;
  items: CalendarItem[];
}

function iso(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : formatIsoDate(value);
}

/**
 * Erzeugt `weeks` Wochen ab dem Montag, der `weeksBefore` Wochen vor der
 * aktuellen Woche liegt.
 */
export function buildCalendar(
  planned: CalendarPlanned[],
  actual: CalendarActual[],
  opts: { weeks?: number; weeksBefore?: number; today?: Date } = {},
): CalendarDay[][] {
  const weeks = opts.weeks ?? 4;
  const weeksBefore = opts.weeksBefore ?? 1;
  const today = opts.today ?? new Date();
  const todayIso = formatIsoDate(today);
  const firstMonday = mondayOfIso(addDays(today, -weeksBefore * 7));
  const startDate = parseIsoDate(firstMonday);

  const plannedByDay = new Map<string, CalendarPlanned[]>();
  for (const p of planned) {
    if (p.status === "replaced" || p.status === "cancelled") continue;
    const key = iso(p.date);
    (plannedByDay.get(key) ?? plannedByDay.set(key, []).get(key)!).push(p);
  }
  const actualByDay = new Map<string, CalendarActual[]>();
  for (const a of actual) {
    const key = iso(a.date);
    (actualByDay.get(key) ?? actualByDay.set(key, []).get(key)!).push(a);
  }

  const grid: CalendarDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = formatIsoDate(addDays(startDate, w * 7 + d));
      const items: CalendarItem[] = [];
      for (const p of plannedByDay.get(date) ?? []) {
        items.push({
          kind: "planned",
          sport: p.sport,
          label: p.title,
          durationMin: p.plannedDurationMin,
          status: p.status,
          distanceKm:
            typeof p.plannedDistanceM === "number" ? p.plannedDistanceM / 1000 : null,
          rpe: p.rpe ?? null,
          description: p.description ?? null,
        });
      }
      for (const a of actualByDay.get(date) ?? []) {
        items.push({
          kind: "actual",
          sport: a.sport,
          label: a.sport,
          durationMin: Math.round(a.durationMin ?? 0),
          distanceKm: a.distanceKm ?? null,
          load: a.load ?? null,
          rpe: a.rpe ?? null,
          avgHr: a.avgHr ?? null,
        });
      }
      week.push({
        date,
        inPast: date < todayIso,
        isToday: date === todayIso,
        items,
      });
    }
    grid.push(week);
  }
  return grid;
}
