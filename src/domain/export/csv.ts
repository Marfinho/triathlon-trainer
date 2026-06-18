/**
 * CSV-Export von Ist-Aktivitäten (rein/testbar). Erzeugt eine RFC-4180-konforme
 * CSV-Zeichenkette (Felder mit Komma/Anführungszeichen/Zeilenumbruch werden
 * korrekt gequotet), damit der Athlet seine Daten z. B. in Excel/Numbers oder
 * anderen Tools weiterverarbeiten kann.
 */

export interface CsvActivity {
  date: Date | string;
  sport: string;
  durationMin: number | null;
  distanceKm: number | null;
  load: number | null;
  rpe: number | null;
  avgHr: number | null;
  avgPower: number | null;
  source: string;
}

const HEADERS = [
  "date",
  "sport",
  "duration_min",
  "distance_km",
  "load",
  "rpe",
  "avg_hr",
  "avg_power",
  "source",
] as const;

function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cell(value: string | number | null | undefined): string {
  if (value == null) return "";
  return escapeField(String(value));
}

function isoDate(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export function activitiesToCsv(activities: CsvActivity[]): string {
  const lines = [HEADERS.join(",")];
  for (const a of activities) {
    lines.push(
      [
        cell(isoDate(a.date)),
        cell(a.sport),
        cell(a.durationMin),
        cell(a.distanceKm),
        cell(a.load),
        cell(a.rpe),
        cell(a.avgHr),
        cell(a.avgPower),
        cell(a.source),
      ].join(","),
    );
  }
  return lines.join("\r\n");
}
