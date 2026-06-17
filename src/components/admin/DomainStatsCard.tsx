import { Card } from "@/components/dashboard/Card";
import type { DomainStats } from "@/lib/admin-stats";
import { formatNumber } from "./format";

function Kpi({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p
        className={`mt-0.5 text-lg font-semibold tabular-nums ${
          warn && value > 0 ? "text-amber-600" : "text-neutral-900"
        }`}
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}

export function DomainStatsCard({ domain }: { domain: DomainStats }) {
  return (
    <Card title="Inhalte & Sync" subtitle="Datenbestand und Synchronisation">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Geplante WO" value={domain.plannedWorkouts} />
        <Kpi label="Aktivitäten" value={domain.actualActivities} />
        <Kpi label="Rennen" value={domain.raceEvents} />
        <Kpi label="Plan-Importe" value={domain.planImports} />
        <Kpi label="Geräte" value={domain.gearItems} />
        <Kpi label="Sync-Logs (24 h)" value={domain.syncLogsLast24h} />
        <Kpi label="Queue offen" value={domain.syncQueuePending} warn />
        <Kpi label="Queue fehlerhaft" value={domain.syncQueueFailed} warn />
      </div>
    </Card>
  );
}
