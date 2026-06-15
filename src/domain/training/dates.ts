/**
 * Datums-Hilfsfunktionen. Alle Operationen laufen in UTC, um Zeitzonen- und
 * Sommerzeit-Effekte zu vermeiden. Plan-Datumsangaben haben das Format
 * `YYYY-MM-DD`.
 */

/** Parst `YYYY-MM-DD` zu einem Date auf UTC-Mitternacht. */
export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Formatiert ein Date als `YYYY-MM-DD` (UTC). */
export function formatIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Addiert `days` Tage (UTC) und gibt ein neues Date zurück. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Liefert alle `YYYY-MM-DD`-Tage ab `start` für `count` Tage (inklusive). */
export function eachIsoDateInRange(start: string, count: number): string[] {
  const startDate = parseIsoDate(start);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(formatIsoDate(addDays(startDate, i)));
  }
  return out;
}

/** Ganztägige Differenz (b - a) in Tagen. */
export function diffInDays(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/** Montag (UTC) der Woche, in der `date` liegt – als `YYYY-MM-DD`. */
export function mondayOfIso(date: Date | string): string {
  const d = typeof date === "string" ? parseIsoDate(date) : new Date(date.getTime());
  const day = d.getUTCDay(); // 0 = Sonntag
  const delta = day === 0 ? -6 : 1 - day;
  return formatIsoDate(addDays(d, delta));
}
