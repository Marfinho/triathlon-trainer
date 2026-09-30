import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { addDays } from "@/domain/training/dates";
import { buildLoadSeries } from "@/domain/training/trainingLoad";
import {
  buildPerformanceModel,
  perfActivityFromRow,
} from "@/domain/training/performanceModel";
import { RacePlanner, type Race } from "@/components/dashboard/RacePlanner";
import { RacePredictions } from "@/components/dashboard/RacePredictions";

export const dynamic = "force-dynamic";

export default async function RacePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  const userId = session.user.id;

  const now = new Date();
  const loadWindowStart = addDays(now, -365);

  const [races, athlete, loadActivities] = await Promise.all([
    prisma.raceEvent.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.athleteProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.actualActivity.findMany({
      where: { userId, date: { gte: loadWindowStart } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        sport: true,
        durationMin: true,
        distanceKm: true,
        load: true,
        rpe: true,
        avgHr: true,
        avgPower: true,
        maxHr: true,
        elevationGainM: true,
      },
    }),
  ]);

  const racesData: Race[] = races.map((r) => ({
    id: r.id,
    name: r.name,
    date: r.date.toISOString(),
    type: r.type,
    distance: r.distance,
    priority: r.priority,
    notes: r.notes,
    completed: r.completed,
    resultSeconds: r.resultSeconds,
    resultPlacement: r.resultPlacement,
    resultNote: r.resultNote,
    locationName: r.locationName,
  }));

  const loadSeries = buildLoadSeries(
    loadActivities.map((a) => ({
      date: a.date,
      sport: a.sport,
      durationMin: a.durationMin,
      load: a.load,
      rpe: a.rpe,
      avgHr: a.avgHr,
    })),
    { days: 90, today: now, thresholdHr: athlete?.thresholdHr },
  );

  const performanceModel = buildPerformanceModel({
    activities: loadActivities.map(perfActivityFromRow),
    races: races.map((r) => ({
      date: r.date,
      type: r.type,
      distance: r.distance,
      resultSeconds: r.resultSeconds,
      completed: r.completed,
    })),
    thresholdHr: athlete?.thresholdHr ?? null,
    thresholdPaceSecPerKm: athlete?.thresholdPaceSecPerKm ?? null,
    ftpWatts: athlete?.ftpWatts ?? null,
    cssPer100m: athlete?.thresholdSwimPer100m ?? null,
    today: now,
  });

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
          Brick
        </p>
        <h1 className="mt-3 text-[2rem] font-bold leading-none tracking-tight text-neutral-900 md:text-5xl">
          Wettkampf
        </h1>
      </header>
      <div className="space-y-5">
        <RacePlanner initialRaces={racesData} />
        <RacePredictions
          model={performanceModel}
          ctl={loadSeries.current.ctl}
          races={racesData.map((r) => ({
            id: r.id,
            name: r.name,
            date: r.date,
            type: r.type,
            distance: r.distance,
          }))}
        />
      </div>
    </main>
  );
}
