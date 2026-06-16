import { Card, sportLabel, sportColor } from "./Card";
import type { SeasonStats } from "@/domain/training/stats";

export function SeasonStatsCard({ stats }: { stats: SeasonStats }) {
  return (
    <Card
      title="Saison-Statistik & Bestwerte"
      subtitle="Gesamtvolumen, Bestwerte je Disziplin und Trainings-Streak"
    >
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="Einheiten" value={String(stats.totalSessions)} />
        <Kpi label="Stunden" value={stats.totalHours.toFixed(1)} />
        <Kpi label="Distanz" value={`${stats.totalKm} km`} />
        <Kpi label="Streak" value={`${stats.currentStreakDays} d`} />
        <Kpi label="Top-Woche" value={`${stats.biggestWeekLoad}`} sub="Load" />
      </div>

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
