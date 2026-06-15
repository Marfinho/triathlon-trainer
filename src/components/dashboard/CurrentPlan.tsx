import { Card, sportLabel } from "./Card";

export interface PlannedItem {
  id: string;
  date: string;
  sport: string;
  title: string;
  plannedDurationMin: number;
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  planned: "bg-slate-700 text-slate-200",
  synced: "bg-emerald-800 text-emerald-100",
  completed: "bg-sky-800 text-sky-100",
};

export function CurrentPlan({ items }: { items: PlannedItem[] }) {
  return (
    <Card
      title="Aktueller Plan"
      subtitle="Nächste geplante Einheiten (offen/synchronisiert)"
    >
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">
          Keine offenen geplanten Workouts. Importiere einen Plan, um zu starten.
        </p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {items.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">
                  {w.title}
                </p>
                <p className="text-xs text-slate-500">
                  {w.date} · {sportLabel(w.sport)} ·{" "}
                  {w.sport === "rest"
                    ? "Ruhetag"
                    : `${w.plannedDurationMin} min`}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  STATUS_STYLES[w.status] ?? "bg-slate-700 text-slate-200"
                }`}
              >
                {w.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
