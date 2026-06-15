import { Card, sportLabel } from "./Card";
import type { PlanVsActualRow } from "@/domain/training/planVsActual";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  completed: { label: "erledigt", cls: "bg-emerald-800 text-emerald-100" },
  missed: { label: "verpasst", cls: "bg-rose-900 text-rose-100" },
  upcoming: { label: "geplant", cls: "bg-slate-700 text-slate-200" },
  unplanned: { label: "ungeplant", cls: "bg-amber-900 text-amber-100" },
};

export function PlanVsActual({ rows }: { rows: PlanVsActualRow[] }) {
  return (
    <Card
      title="Plan vs. Ist"
      subtitle="Abgleich geplanter Einheiten mit Ist-Aktivitäten"
    >
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Keine Daten im Zeitraum.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Datum</th>
                <th className="py-2 pr-3 font-medium">Geplant</th>
                <th className="py-2 pr-3 font-medium">Ist</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((r, i) => {
                const badge = STATUS_BADGE[r.status];
                return (
                  <tr key={`${r.date}-${i}`}>
                    <td className="py-2 pr-3 text-slate-400">{r.date}</td>
                    <td className="py-2 pr-3 text-slate-200">
                      {r.planned
                        ? `${sportLabel(r.planned.sport)} · ${r.planned.title} (${r.planned.plannedDurationMin}′)`
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 text-slate-200">
                      {r.actual
                        ? `${sportLabel(r.actual.sport)}${
                            r.actual.durationMin
                              ? ` · ${Math.round(r.actual.durationMin)}′`
                              : ""
                          }${
                            r.actual.distanceKm
                              ? ` · ${r.actual.distanceKm.toFixed(1)} km`
                              : ""
                          }`
                        : "—"}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
