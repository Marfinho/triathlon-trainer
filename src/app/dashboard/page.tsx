import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DashboardGrid } from "@/components/dashboard-grid/DashboardGrid";
import { DashboardDataProvider } from "@/components/dashboard-grid/DashboardDataProvider";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/OnboardingChecklist";
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

  const userId = session.user.id;
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingDismissedAt: true },
  });
  let steps: OnboardingStep[] = [];
  if (!dbUser?.onboardingDismissedAt) {
    const [profile, races, integrations, planned] = await Promise.all([
      prisma.athleteProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.raceEvent.count({ where: { userId } }),
      prisma.userIntegration.count({ where: { userId, enabled: true } }),
      prisma.plannedWorkout.count({ where: { userId } }),
    ]);
    steps = [
      {
        key: "profile",
        label: "Profil & Schwellenwerte ausfüllen",
        hint: "Gewicht, FTP, Schwellenpuls und -pace – Basis für Zonen und Prognosen.",
        href: "/profile",
        done: Boolean(profile && (profile.ftpWatts || profile.thresholdHr || profile.thresholdPaceSecPerKm || profile.weightKg)),
      },
      { key: "race", label: "Wettkampf eintragen", hint: "Dein Ziel-Event für Plan und Vorhersage.", href: "/race", done: races > 0 },
      { key: "integration", label: "Trainingsplattform verbinden", hint: "Strava, Wahoo, Withings oder Intervals.icu im Profil.", href: "/profile", done: integrations > 0 },
      { key: "plan", label: "Ersten Plan importieren", hint: "Lass deine KI einen Plan erstellen und importiere ihn im Coach-Bereich.", href: "/coach", done: planned > 0 },
    ];
    if (steps.every((s) => s.done)) steps = [];
  }

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
          Brick
        </p>
        <h1 className="mt-3 text-[2rem] font-bold leading-none tracking-tight text-neutral-900 md:text-5xl">
          Heute
        </h1>
      </header>
      {steps.length > 0 && <OnboardingChecklist steps={steps} />}
      <DashboardDataProvider>
        <DashboardGrid initialWidgets={widgets} />
      </DashboardDataProvider>
    </main>
  );
}
