import { Card } from "@/components/dashboard/Card";
import type { UserStats } from "@/lib/admin-stats";
import { formatNumber } from "./format";

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">{value}</p>
      {sub ? <p className="text-[11px] text-neutral-400">{sub}</p> : null}
    </div>
  );
}

const PLAN_LABELS: Record<string, string> = { free: "Free", paid: "Paid" };

export function UserStatsCard({ users }: { users: UserStats }) {
  const planEntries = Object.entries(users.byPlan);
  const total = users.total || 1;
  return (
    <Card title="Nutzer" subtitle="Bestand, Pläne und Zugänge">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Gesamt" value={formatNumber(users.total)} />
        <Kpi label="Admins" value={formatNumber(users.admins)} />
        <Kpi label="Abos aktiv" value={formatNumber(users.withActiveSubscription)} />
        <Kpi label="Neu (7 T.)" value={formatNumber(users.newLast7Days)} />
        <Kpi label="Neu (30 T.)" value={formatNumber(users.newLast30Days)} />
        <Kpi label="Integrationen" value={formatNumber(users.activeIntegrations)} />
      </div>

      <div className="mt-5">
        <p className="mb-1.5 text-[11px] uppercase tracking-wide text-neutral-400">
          Verteilung nach Plan
        </p>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100">
          {planEntries.map(([plan, count]) => (
            <div
              key={plan}
              title={`${PLAN_LABELS[plan] ?? plan}: ${count}`}
              style={{
                width: `${(count / total) * 100}%`,
                backgroundColor: plan === "paid" ? "#16a34a" : "#94a3b8",
              }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          {planEntries.map(([plan, count]) => (
            <span key={plan} className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: plan === "paid" ? "#16a34a" : "#94a3b8" }}
              />
              {PLAN_LABELS[plan] ?? plan}: {formatNumber(count)}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
