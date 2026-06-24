import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UserRolesManager } from "@/components/admin/UserRolesManager";
import { SyncQueueMonitor } from "@/components/admin/SyncQueueMonitor";
import { SystemLogsViewer } from "@/components/admin/SystemLogsViewer";
import { PlanLimitsEditor } from "@/components/admin/PlanLimitsEditor";
import { IntegrationsAdmin } from "@/components/admin/IntegrationsAdmin";
import {
  getEffectiveLimits,
  defaultLimits,
  knownTiers,
  toJsonSafeLimits,
  type PlanOverrideSettings,
} from "@/lib/plan-config";
import { listIntegrationConfigViews } from "@/lib/integration-config";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const [totalUsers, paidUsers, activeIntegrations, dailyActiveUsers, recentSignups, tiers, integrations] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { plan: "paid" } }),
      prisma.userIntegration.count({ where: { enabled: true } }),
      prisma.user.count({
        where: {
          updatedAt: {
            gte: new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000) } },
        select: { id: true, email: true, name: true, createdAt: true, plan: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      (async () => {
        const tiersList = knownTiers();
        const overrides = await prisma.planOverride.findMany();
        const overrideByTier = new Map(overrides.map((o) => [o.tier, o]));

        return Promise.all(
          tiersList.map(async (tier) => {
            const effective = await getEffectiveLimits(tier);
            const row = overrideByTier.get(tier);
            return {
              tier,
              defaults: toJsonSafeLimits(defaultLimits(tier)),
              effective: toJsonSafeLimits(effective),
              override: (row?.settingsJson as PlanOverrideSettings | undefined) ?? null,
              updatedAt: row?.updatedAt ?? null,
              updatedBy: row?.updatedBy ?? null,
            };
          }),
        );
      })(),
      listIntegrationConfigViews(),
    ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Administration</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
          Admin-Panel
        </h1>
      </header>

      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Alle Nutzer</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-900">{totalUsers}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Bezahlende Nutzer</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-900">{paidUsers}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Aktive Integrationen</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-900">{activeIntegrations}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Aktiv heute (24h)</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-900">{dailyActiveUsers}</p>
          </div>
        </div>

        {/* Recent Signups */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Neue Registrierungen (7 Tage)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="px-4 py-3 text-left font-semibold text-neutral-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-700">E-Mail</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-700">Tarif</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-700">Anmeldung</th>
                </tr>
              </thead>
              <tbody>
                {recentSignups.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-3 text-neutral-900">{user.name || "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        user.plan === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-neutral-100 text-neutral-700"
                      }`}>
                        {user.plan === "paid" ? "Bezahlt" : "Kostenlos"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {new Date(user.createdAt).toLocaleDateString("de-DE")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Plan Limits */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Plan-Limits pro Tarif</h2>
          <PlanLimitsEditor initialTiers={tiers} />
        </div>

        {/* Integrations */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">OAuth-Provider verwalten</h2>
          <IntegrationsAdmin initial={integrations} />
        </div>

        {/* User Roles */}
        <UserRolesManager />

        {/* Sync Queue */}
        <SyncQueueMonitor />

        {/* System Logs */}
        <SystemLogsViewer />
      </div>
    </main>
  );
}
