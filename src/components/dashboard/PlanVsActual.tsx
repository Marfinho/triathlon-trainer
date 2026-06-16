import { Card, sportLabel } from "./Card";
import type {
  PlanVsActualRow,
  WeekCompliance,
} from "@/domain/training/planVsActual";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  completed: { label: "erledigt", cls: "bg-emerald-50 text-emerald-700" },
  missed: { label: "verpasst", cls: "bg-rose-50 text-rose-700" },
  upcoming: { label: "geplant", cls: "bg-neutral-100 text-neutral-600" },
  unplanned: { label: "ungeplant", cls: "bg-amber-50 text-amber-700" },
};

function fmtWeek(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
}

function complianceColor(pct: number): string {
  if (pct >= 80) return "#34c759";
  if (pct >= 50) return "#ff9f0a";
  return "#ff3b30";
}

export function PlanVsActual({
  rows,
  weeks,
}: {
  rows: PlanVsActualRow[];
  weeks: WeekCompliance[];
}) {
  return (
    <Card
      title="Plan vs. Ist"
      subtitle="Wochen-Compliance und Abgleich mit Ist-Aktivitäten"
    >
      {weeks.length > 0 ? (
        (() => {
          const recent = weeks.slice(-4);
          const planned = recent.reduce((s, w) => s + w.planned, 0);
          const completed = recent.reduce((s, w) => s + w.completed, 0);
          const overall = planned ? Math.round((completed / planned) * 100) : 0;
          return (
            <div
              className="mb-4 flex items-center justify-between rounded-xl border px-3 py-2"
              style={{
                borderColor: `${complianceColor(overall)}44`,
                backgroundColor: `${complianceColor(overall)}11`,
              }}
            >
              <span className="text-sm font-medium text-neutral-800">
                Compliance (4 Wochen)
              </span>
              <span
                className="text-lg font-semibold"
                style={{ color: complianceColor(overall) }}
              >
                {overall}%{" "}
                <span className="text-xs font-normal text-neutral-400">
                  {completed}/{planned}
                </span>
              </span>
            </div>
          );
        })()
      ) : null}

      {weeks.length > 0 ? (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {weeks.slice(-4).map((w) => (
            <div
              key={w.weekStart}
              className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
            >
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">
                KW ab {fmtWeek(w.weekStart)}
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span
                  className="text-xl font-semibold"
                  style={{ color: complianceColor(w.compliancePct) }}
                >
                  {w.compliancePct}%
                </span>
                <span className="text-xs text-neutral-500">
                  {w.completed}/{w.planned}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${w.compliancePct}%`,
                    backgroundColor: complianceColor(w.compliancePct),
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] text-neutral-500">
                {Math.round(w.actualMin)}′ / {w.plannedMin}′ geplant
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400">Keine Daten im Zeitraum.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-xs uppercase tracking-wide text-neutral-400">
                <th className="py-2 pr-3 font-medium">Datum</th>
                <th className="py-2 pr-3 font-medium">Geplant</th>
                <th className="py-2 pr-3 font-medium">Ist</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r, i) => {
                const badge = STATUS_BADGE[r.status];
                return (
                  <tr key={`${r.date}-${i}`}>
                    <td className="py-2 pr-3 text-neutral-500">{r.date}</td>
                    <td className="py-2 pr-3 text-neutral-800">
                      {r.planned
                        ? `${sportLabel(r.planned.sport)} · ${r.planned.title} (${r.planned.plannedDurationMin}′)`
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 text-neutral-800">
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
