import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { addDays, formatIsoDate } from "@/domain/training/dates";
import type { TimelineSegmentInput } from "@/integrations/trainer/workoutPlayer";
import { TrainerControl, type TrainerWorkout } from "@/components/dashboard/TrainerControl";

export const dynamic = "force-dynamic";

export default async function TrainerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  const userId = session.user.id;

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

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          LocalHub
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
          Rollentrainer
        </h1>
      </header>
      <div className="space-y-5">
        <TrainerControl workouts={trainerWorkouts} defaultFtp={athlete?.ftpWatts ?? 200} />
      </div>
    </main>
  );
}
