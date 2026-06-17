import { Card } from "@/components/dashboard/Card";
import type { SystemStats } from "@/lib/admin-stats";
import { formatBytes, formatDuration } from "./format";

function Gauge({ label, pct, detail }: { label: string; pct: number; detail: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color =
    clamped >= 90 ? "#dc2626" : clamped >= 70 ? "#f59e0b" : "#2563eb";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-neutral-600">{label}</span>
        <span className="text-xs tabular-nums text-neutral-500">{clamped}%</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-1 text-[11px] text-neutral-400">{detail}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

export function SystemStatus({
  system,
  generatedAt,
}: {
  system: SystemStats;
  generatedAt: string;
}) {
  const usedMem = system.totalMemBytes - system.freeMemBytes;
  return (
    <Card
      title="Auslastung & Laufzeit"
      subtitle={`Stand: ${new Date(generatedAt).toLocaleString("de-DE")}`}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Gauge
          label="CPU-Last (1 min)"
          pct={system.loadPerCorePct}
          detail={`Load ${system.loadAvg.map((l) => l.toFixed(2)).join(" / ")} · ${system.cpuCount} Kerne`}
        />
        <Gauge
          label="Arbeitsspeicher"
          pct={system.usedMemPct}
          detail={`${formatBytes(usedMem)} von ${formatBytes(system.totalMemBytes)} belegt`}
        />
        <Gauge
          label="DB-Größe"
          pct={
            system.dbSizeBytes != null
              ? Math.min(100, Math.round((system.dbSizeBytes / (1024 * 1024 * 1024)) * 100))
              : 0
          }
          detail={`${formatBytes(system.dbSizeBytes)} (Anteil an 1 GB)`}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Prozess-RSS" value={formatBytes(system.processRssBytes)} />
        <Stat label="Heap genutzt" value={formatBytes(system.processHeapUsedBytes)} />
        <Stat label="Prozess-Uptime" value={formatDuration(system.processUptimeSec)} />
        <Stat label="System-Uptime" value={formatDuration(system.systemUptimeSec)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-neutral-400">
        <span>Host: {system.hostname}</span>
        <span>Plattform: {system.platform}</span>
        <span>Node: {system.nodeVersion}</span>
      </div>
    </Card>
  );
}
