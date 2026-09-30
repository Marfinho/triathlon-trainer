import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DashboardGrid } from "@/components/dashboard-grid/DashboardGrid";
import { DashboardDataProvider } from "@/components/dashboard-grid/DashboardDataProvider";
import { parseWidgetLayout, type WidgetInstance } from "@/components/dashboard-grid/types";

export const dynamic = "force-dynamic";

const DEFAULT_WIDGETS: WidgetInstance[] = [
  { id: "today-workout", type: "TodayWorkout", size: "M" },
  { id: "form-gauge", type: "FormGauge", size: "S" },
  { id: "readiness-checkin", type: "ReadinessCheckin", size: "S" },
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const config = await prisma.dashboardConfig.findUnique({
    where: { userId: session.user.id },
  });
  const stored = parseWidgetLayout(config?.layoutJson);
  const widgets = stored.length ? stored : DEFAULT_WIDGETS;

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          LocalHub
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
          Heute
        </h1>
      </header>
      <DashboardDataProvider>
        <DashboardGrid initialWidgets={widgets} />
      </DashboardDataProvider>
    </main>
  );
}
