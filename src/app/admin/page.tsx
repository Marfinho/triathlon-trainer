import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const [totalUsers, paidUsers, activeIntegrations, dailyActiveUsers, recentSignups] =
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

        {/* Info Box */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <h3 className="font-semibold text-blue-900">Weitere Admin-Funktionen</h3>
          <ul className="mt-3 space-y-2 text-sm text-blue-800">
            <li>• Nutzer-Rollen verwalten</li>
            <li>• Plan-Limits pro Tarif konfigurieren</li>
            <li>• OAuth-Provider aktivieren/deaktivieren</li>
            <li>• Sync-Queue überwachen</li>
            <li>• System-Logs ansehen</li>
          </ul>
          <p className="mt-4 text-xs text-blue-700">
            Diese Funktionen werden in zukünftigen Updates hinzugefügt.
          </p>
        </div>
      </div>
    </main>
  );
}
