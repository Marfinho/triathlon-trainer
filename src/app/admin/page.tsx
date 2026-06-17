import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { collectAdminStats } from "@/lib/admin-stats";
import {
  getEffectiveLimits,
  defaultLimits,
  knownTiers,
  toJsonSafeLimits,
  type PlanOverrideSettings,
} from "@/lib/plan-config";
import { SystemStatus } from "@/components/admin/SystemStatus";
import { UserStatsCard } from "@/components/admin/UserStatsCard";
import { DomainStatsCard } from "@/components/admin/DomainStatsCard";
import { PlanLimitsEditor, type TierConfig } from "@/components/admin/PlanLimitsEditor";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "admin") redirect("/dashboard");

  const stats = await collectAdminStats(prisma);

  const overrides = await prisma.planOverride.findMany();
  const overrideByTier = new Map(overrides.map((o) => [o.tier, o]));
  const tiers: TierConfig[] = await Promise.all(
    knownTiers().map(async (tier) => {
      const effective = await getEffectiveLimits(tier);
      const row = overrideByTier.get(tier);
      return {
        tier,
        defaults: toJsonSafeLimits(defaultLimits(tier)),
        effective: toJsonSafeLimits(effective),
        override: (row?.settingsJson as PlanOverrideSettings | undefined) ?? null,
        updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
        updatedBy: row?.updatedBy ?? null,
      };
    }),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
            LocalHub · Admin
          </p>
          <a
            href="/dashboard"
            className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
          >
            Zurück zum Dashboard
          </a>
        </div>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-neutral-900">
          Systemverwaltung
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Plan-Limits & Pay-Features konfigurieren sowie Auslastung, Nutzer und
          Statistiken überwachen.
        </p>
      </header>

      <div className="space-y-10">
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Systemstatus
          </h2>
          <SystemStatus system={stats.system} generatedAt={stats.generatedAt} />
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <UserStatsCard users={stats.users} />
          <DomainStatsCard domain={stats.domain} />
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Plan-Limits & Pay-Features
          </h2>
          <PlanLimitsEditor initialTiers={tiers} />
        </section>
      </div>
    </main>
  );
}
