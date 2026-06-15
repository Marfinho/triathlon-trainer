import { Card, sportLabel } from "./Card";

export interface ActivityItem {
  id: string;
  date: string;
  sport: string;
  durationMin: number | null;
  distanceKm: number | null;
  load: number | null;
  source: string;
}

export function RecentActivities({ items }: { items: ActivityItem[] }) {
  return (
    <Card
      title="Letzte Ist-Aktivitäten"
      subtitle="Aus Intervals.icu / manuell – unantastbar"
    >
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Keine Ist-Aktivitäten erfasst.</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {sportLabel(a.sport)}
                </p>
                <p className="text-xs text-slate-500">
                  {a.date} ·{" "}
                  {a.durationMin ? `${Math.round(a.durationMin)} min` : "—"}
                  {a.distanceKm ? ` · ${a.distanceKm.toFixed(1)} km` : ""}
                </p>
              </div>
              <span className="text-xs text-slate-500">
                {a.load ? `Load ${Math.round(a.load)}` : a.source}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
