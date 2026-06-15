import { formatIsoDate } from "./dates";

/**
 * Plan-vs-Ist-Auswertung. Vergleicht geplante Workouts mit Ist-Aktivitäten je
 * Tag und leitet einen Status ab. Rein – Daten werden als Parameter übergeben.
 */

export interface PlannedInput {
  id: string;
  date: Date | string;
  sport: string;
  title: string;
  plannedDurationMin: number;
  status: string;
}

export interface ActualInput {
  id: string;
  date: Date | string;
  sport: string;
  durationMin: number | null;
  distanceKm: number | null;
}

export type PlanVsActualStatus =
  | "completed"
  | "missed"
  | "upcoming"
  | "unplanned";

export interface PlanVsActualRow {
  date: string;
  planned?: {
    id: string;
    sport: string;
    title: string;
    plannedDurationMin: number;
    status: string;
  };
  actual?: {
    id: string;
    sport: string;
    durationMin: number | null;
    distanceKm: number | null;
  };
  status: PlanVsActualStatus;
}

function toIso(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : formatIsoDate(value);
}

function startOfDayIso(date: Date): string {
  return formatIsoDate(date);
}

export function buildPlanVsActual(
  planned: PlannedInput[],
  actual: ActualInput[],
  today: Date = new Date(),
): PlanVsActualRow[] {
  const todayIso = startOfDayIso(today);
  const rows: PlanVsActualRow[] = [];

  // Ist-Aktivitäten nach Tag+Sport gruppieren (Mehrfachzuordnung vermeiden).
  const actualByDate = new Map<string, ActualInput[]>();
  for (const a of actual) {
    const key = toIso(a.date);
    const list = actualByDate.get(key) ?? [];
    list.push(a);
    actualByDate.set(key, list);
  }
  const usedActualIds = new Set<string>();

  // Geplante Workouts (ohne replaced/cancelled) auswerten.
  for (const p of planned) {
    if (p.status === "replaced" || p.status === "cancelled") continue;
    const dateIso = toIso(p.date);
    const candidates = actualByDate.get(dateIso) ?? [];
    const match =
      candidates.find(
        (a) => a.sport === p.sport && !usedActualIds.has(a.id),
      ) ?? candidates.find((a) => !usedActualIds.has(a.id));
    if (match) usedActualIds.add(match.id);

    let status: PlanVsActualStatus;
    if (p.status === "completed" || match) {
      status = "completed";
    } else if (dateIso < todayIso) {
      status = "missed";
    } else {
      status = "upcoming";
    }

    rows.push({
      date: dateIso,
      planned: {
        id: p.id,
        sport: p.sport,
        title: p.title,
        plannedDurationMin: p.plannedDurationMin,
        status: p.status,
      },
      actual: match
        ? {
            id: match.id,
            sport: match.sport,
            durationMin: match.durationMin,
            distanceKm: match.distanceKm,
          }
        : undefined,
      status,
    });
  }

  // Ungeplante Ist-Aktivitäten (kein passendes geplantes Workout).
  for (const a of actual) {
    if (usedActualIds.has(a.id)) continue;
    rows.push({
      date: toIso(a.date),
      actual: {
        id: a.id,
        sport: a.sport,
        durationMin: a.durationMin,
        distanceKm: a.distanceKm,
      },
      status: "unplanned",
    });
  }

  rows.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  return rows;
}
