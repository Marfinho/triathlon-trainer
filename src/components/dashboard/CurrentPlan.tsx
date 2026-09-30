import { Card, sportLabel, sportColor } from "./Card";

export interface PlannedItem {
  id: string;
  date: string;
  sport: string;
  title: string;
  plannedDurationMin: number;
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  planned: "bg-neutral-100 text-neutral-600",
  synced: "bg-emerald-50 text-emerald-700",
  completed: "bg-blue-50 text-blue-700",
};

function relativeDay(iso: string): { label: string; highlight: boolean } {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
  if (iso === todayIso) return { label: "heute", highlight: true };
  if (iso === tomorrow) return { label: "morgen", highlight: false };
  return { label: iso, highlight: false };
}

export function CurrentPlan({ items }: { items: PlannedItem[] }) {
  return (
    <Card
      title="Aktueller Plan"
      subtitle="Nächste geplante Einheiten"
    >
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Keine offenen geplanten Workouts. Importiere einen Plan, um zu starten.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((w) => {
            const rel = relativeDay(w.date);
            return (
            <li key={w.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: sportColor(w.sport) }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {w.title}
                  </p>
                  <p className="text-xs text-neutral-500">
                    <span className={rel.highlight ? "font-semibold text-blue-600" : ""}>
                      {rel.label}
                    </span>{" "}
                    · {sportLabel(w.sport)} ·{" "}
                    {w.sport === "rest" ? "Ruhetag" : `${w.plannedDurationMin} min`}
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  STATUS_STYLES[w.status] ?? "bg-neutral-100 text-neutral-600"
                }`}
              >
                {w.status}
              </span>
            </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
