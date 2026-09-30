import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { addDays, formatIsoDate } from "@/domain/training/dates";
import type { TimelineSegmentInput } from "@/integrations/trainer/workoutPlayer";
import { TrainerControl, type TrainerWorkout } from "@/components/dashboard/TrainerControl";
import { StrengthWorkoutList } from "@/components/exercises/StrengthWorkoutList";

export const dynamic = "force-dynamic";

type Tab = "rolle" | "kraft";

const TABS: { value: Tab; label: string; heading: string }[] = [
  { value: "rolle", label: "Rollentrainer", heading: "Rollentrainer" },
  { value: "kraft", label: "Kraft und Mobility", heading: "Kraft und Mobility" },
];

export default async function TrainerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  const userId = session.user.id;
  const params = await searchParams;
  const tab: Tab = params.tab === "kraft" ? "kraft" : "rolle";
  const current = TABS.find((t) => t.value === tab)!;

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
          LocalHub
        </p>
        <h1 className="mt-3 text-[2rem] font-bold leading-none tracking-tight text-neutral-900 md:text-5xl">
          {current.heading}
        </h1>
        <nav aria-label="Trainer-Bereiche" className="mt-4 flex gap-1 border-b border-neutral-200">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={t.value === "rolle" ? "/trainer" : "/trainer?tab=kraft"}
              aria-current={t.value === tab ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                t.value === tab
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="space-y-5">
        {tab === "rolle" ? <BikeTrainer userId={userId} /> : <StrengthWorkoutList userId={userId} />}
      </div>
    </main>
  );
}

/** Bestehende Rollentrainer-Ansicht (unverändert). */
async function BikeTrainer({ userId }: { userId: string }) {
  const now = new Date();
  const windowEnd = addDays(now, 21);

  const [bikeWorkouts, athlete] = await Promise.all([
    prisma.plannedWorkout.findMany({
      where: {
        userId,
        sport: { in: ["bike", "brick"] },
        status: { in: ["planned", "synced"] },
        date: { gte: addDays(now, -1), lte: windowEnd },
      },
      orderBy: { date: "asc" },
      take: 10,
    }),
    prisma.athleteProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const trainerWorkouts: TrainerWorkout[] = bikeWorkouts.map((w) => {
    const segments = Array.isArray(w.segmentsJson)
      ? (w.segmentsJson as unknown as TimelineSegmentInput[])
      : [];
    return {
      id: w.id,
      date: formatIsoDate(w.date),
      title: w.title,
      plannedDurationMin: w.plannedDurationMin,
      segments,
    };
  });

  return <TrainerControl workouts={trainerWorkouts} defaultFtp={athlete?.ftpWatts ?? 200} />;
}
