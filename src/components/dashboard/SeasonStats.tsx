import { Card, sportLabel, sportColor } from "./Card";
import type { SeasonStats } from "@/domain/training/stats";

export function SeasonStatsCard({ stats }: { stats: SeasonStats }) {
  return (
    <Card
      title="Saison-Statistik & Bestwerte"
      subtitle="Gesamtvolumen, Bestwerte je Disziplin und Trainings-Streak"
    >
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Kpi label="Einheiten" value={String(stats.totalSessions)} />
        <Kpi label="Stunden" value={stats.totalHours.toFixed(1)} />
        <Kpi label="Ø / Woche" value={`${stats.avgWeeklyHours} h`} />
        <Kpi label="Distanz" value={`${stats.totalKm} km`} />
        <Kpi label="Streak" value={`${stats.currentStreakDays} d`} />
        <Kpi
          label="Top-Woche"
          value={`${stats.biggestWeekLoad}`}
          sub={
            stats.biggestWeekStart
              ? `ab ${stats.biggestWeekStart.slice(8, 10)}.${stats.biggestWeekStart.slice(5, 7)}.`
              : "Load"
          }
        />
      </div>

      {stats.bySport.length > 0 ? (
        <div className="mb-4">
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-neutral-400">
            Zeitverteilung
          </p>
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {(() => {
              const total = stats.bySport.reduce((s, x) => s + x.totalMin, 0) || 1;
              return stats.bySport.map((s) => (
                <div
                  key={s.sport}
                  title={`${sportLabel(s.sport)} · ${Math.round((s.totalMin / total) * 100)}%`}
                  style={{
                    width: `${(s.totalMin / total) * 100}%`,
                    backgroundColor: sportColor(s.sport),
                  }}
                />
              ));
            })()}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {stats.bySport.map((s) => (
              <span key={s.sport} className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sportColor(s.sport) }} />
                {sportLabel(s.sport)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {stats.bySport.length === 0 ? (
        <p className="text-sm text-neutral-400">Noch keine Aktivitäten erfasst.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-neutral-400">
                <th className="py-2 pr-3 font-medium">Disziplin</th>
                <th className="py-2 pr-3 font-medium">Einh.</th>
                <th className="py-2 pr-3 font-medium">Stunden</th>
                <th className="py-2 pr-3 font-medium">km</th>
                <th className="py-2 pr-3 font-medium">Längste</th>
                <th className="py-2 pr-3 font-medium">Weiteste</th>
                <th className="py-2 font-medium">Max Load</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {stats.bySport.map((s) => (
                <tr key={s.sport}>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: sportColor(s.sport) }}
                      />
                      {sportLabel(s.sport)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-neutral-700">{s.sessions}</td>
                  <td className="py-2 pr-3 tabular-nums text-neutral-700">
                    {(s.totalMin / 60).toFixed(1)}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-neutral-700">{s.totalKm}</td>
                  <td className="py-2 pr-3 tabular-nums text-neutral-700">{s.longestMin}′</td>
                  <td className="py-2 pr-3 tabular-nums text-neutral-700">{s.farthestKm} km</td>
                  <td className="py-2 tabular-nums text-neutral-700">{s.highestLoad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">
        {label}
        {sub ? ` · ${sub}` : ""}
      </p>
      <p className="mt-0.5 text-xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}
