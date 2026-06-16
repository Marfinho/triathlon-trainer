import { Card, sportLabel, sportColor } from "./Card";

export interface ActivityItem {
  id: string;
  date: string;
  sport: string;
  durationMin: number | null;
  distanceKm: number | null;
  load: number | null;
  source: string;
}

export interface WeekSummary {
  sessions: number;
  hours: number;
  distanceKm: number;
  load: number;
}

export function RecentActivities({
  items,
  summary,
}: {
  items: ActivityItem[];
  summary?: WeekSummary;
}) {
  return (
    <Card
      title="Letzte Aktivitäten"
      subtitle="Ist-Daten aus Intervals.icu / Radrolle / manuell"
    >
      {summary ? (
        <div className="mb-4 grid grid-cols-4 gap-2">
          <SummaryTile label="Einheiten" value={String(summary.sessions)} />
          <SummaryTile label="Stunden" value={summary.hours.toFixed(1)} />
          <SummaryTile label="km" value={Math.round(summary.distanceKm).toString()} />
          <SummaryTile label="Load" value={Math.round(summary.load).toString()} />
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400">Keine Ist-Aktivitäten erfasst.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: sportColor(a.sport) }}
                />
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {sportLabel(a.sport)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {a.date} ·{" "}
                    {a.durationMin ? `${Math.round(a.durationMin)} min` : "—"}
                    {a.distanceKm ? ` · ${a.distanceKm.toFixed(1)} km` : ""}
                  </p>
                </div>
              </div>
              <span className="text-xs text-neutral-400">
                {a.load ? `Load ${Math.round(a.load)}` : a.source}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-neutral-900">{value}</p>
    </div>
  );
}
