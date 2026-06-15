import { formatIsoDate, addDays, mondayOfIso } from "./dates";

/**
 * Trainingsbelastung & Form (rein/testbar).
 *
 * Berechnet aus Ist-Aktivitäten die klassischen Kennzahlen des Performance
 * Management Chart:
 *   - CTL (Fitness):  exponentiell gewichteter 42-Tage-Schnitt der Tageslast
 *   - ATL (Fatigue):  exponentiell gewichteter 7-Tage-Schnitt
 *   - TSB (Form):     CTL − ATL
 *
 * Fehlt die Last einer Aktivität, wird sie aus Dauer und RPE/Intensität
 * geschätzt (TSS-ähnlich).
 */

export interface LoadActivity {
  date: Date | string;
  sport: string;
  durationMin: number | null;
  load: number | null;
  rpe?: number | null;
}

const CTL_TIME_CONSTANT = 42;
const ATL_TIME_CONSTANT = 7;

function toIso(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : formatIsoDate(value);
}

/** RPE (1–10) -> grober Intensity Factor. */
function rpeToIntensityFactor(rpe: number): number {
  return Math.min(1.15, Math.max(0.4, 0.4 + (rpe - 1) * 0.08));
}

/** Last einer Aktivität: gemessen, sonst aus Dauer × Intensität geschätzt. */
export function estimateActivityLoad(a: LoadActivity): number {
  if (typeof a.load === "number" && a.load > 0) return a.load;
  const min = a.durationMin ?? 0;
  if (min <= 0) return 0;
  const intensity =
    typeof a.rpe === "number" ? rpeToIntensityFactor(a.rpe) : 0.65;
  // TSS-ähnlich: IF^2 * Stunden * 100.
  return Math.round(intensity ** 2 * (min / 60) * 100);
}

export interface LoadSeries {
  dates: string[];
  dailyLoad: number[];
  ctl: number[];
  atl: number[];
  tsb: number[];
  current: { ctl: number; atl: number; tsb: number };
}

/**
 * Baut die Tages-Serie für die letzten `days` Tage bis `today`. CTL/ATL starten
 * bei 0 (Aufwärmphase) und werden täglich exponentiell fortgeschrieben.
 */
export function buildLoadSeries(
  activities: LoadActivity[],
  opts: { days?: number; today?: Date } = {},
): LoadSeries {
  const days = opts.days ?? 90;
  const today = opts.today ?? new Date();
  const start = addDays(today, -(days - 1));

  // Tageslast aggregieren.
  const loadByDay = new Map<string, number>();
  for (const a of activities) {
    const key = toIso(a.date);
    loadByDay.set(key, (loadByDay.get(key) ?? 0) + estimateActivityLoad(a));
  }

  const dates: string[] = [];
  const dailyLoad: number[] = [];
  const ctl: number[] = [];
  const atl: number[] = [];
  const tsb: number[] = [];

  const ctlAlpha = 1 / CTL_TIME_CONSTANT;
  const atlAlpha = 1 / ATL_TIME_CONSTANT;
  let prevCtl = 0;
  let prevAtl = 0;

  for (let i = 0; i < days; i++) {
    const dayIso = formatIsoDate(addDays(start, i));
    const load = loadByDay.get(dayIso) ?? 0;
    const c = prevCtl + (load - prevCtl) * ctlAlpha;
    const a = prevAtl + (load - prevAtl) * atlAlpha;
    dates.push(dayIso);
    dailyLoad.push(Math.round(load));
    ctl.push(Math.round(c * 10) / 10);
    atl.push(Math.round(a * 10) / 10);
    tsb.push(Math.round((c - a) * 10) / 10);
    prevCtl = c;
    prevAtl = a;
  }

  return {
    dates,
    dailyLoad,
    ctl,
    atl,
    tsb,
    current: {
      ctl: ctl[ctl.length - 1] ?? 0,
      atl: atl[atl.length - 1] ?? 0,
      tsb: tsb[tsb.length - 1] ?? 0,
    },
  };
}

export interface WeeklyVolume {
  weekStart: string;
  bySport: Record<string, number>;
  totalMin: number;
}

/** Wochenvolumen (Minuten je Disziplin) über die letzten `weeks` Wochen. */
export function buildWeeklyVolume(
  activities: LoadActivity[],
  opts: { weeks?: number; today?: Date } = {},
): WeeklyVolume[] {
  const weeks = opts.weeks ?? 12;
  const today = opts.today ?? new Date();
  const firstMonday = mondayOfIso(addDays(today, -(weeks - 1) * 7));

  const order: string[] = [];
  for (let i = 0; i < weeks; i++) {
    order.push(formatIsoDate(addDays(new Date(`${firstMonday}T00:00:00Z`), i * 7)));
  }
  const map = new Map<string, WeeklyVolume>(
    order.map((w) => [w, { weekStart: w, bySport: {}, totalMin: 0 }]),
  );

  for (const a of activities) {
    const wk = mondayOfIso(a.date);
    const entry = map.get(wk);
    if (!entry) continue; // außerhalb des Fensters
    const min = a.durationMin ?? 0;
    entry.bySport[a.sport] = (entry.bySport[a.sport] ?? 0) + min;
    entry.totalMin += min;
  }

  return order.map((w) => {
    const e = map.get(w)!;
    e.totalMin = Math.round(e.totalMin);
    for (const k of Object.keys(e.bySport)) {
      e.bySport[k] = Math.round(e.bySport[k]);
    }
    return e;
  });
}

export type FormState = "fresh" | "optimal" | "neutral" | "tired" | "overload";

/** Interpretiert TSB (Form) in einen Zustand. */
export function interpretForm(tsb: number): {
  state: FormState;
  label: string;
} {
  if (tsb > 15) return { state: "fresh", label: "Frisch / formgeladen" };
  if (tsb >= 5) return { state: "optimal", label: "Erholt" };
  if (tsb >= -10) return { state: "neutral", label: "Neutral / produktiv" };
  if (tsb >= -25) return { state: "tired", label: "Ermüdet" };
  return { state: "overload", label: "Überlastet – Vorsicht" };
}
