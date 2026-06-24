import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { addDays } from "@/domain/training/dates";
import { buildLoadSeries } from "@/domain/training/trainingLoad";
import {
  resolveRunReference,
  calibrateRiegelExponent,
  bestBikeReference,
} from "@/domain/training/prediction";
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

  const runs = loadActivities.map((a) => ({
    sport: a.sport,
    distanceKm: a.distanceKm,
    durationMin: a.durationMin,
  }));

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          LocalHub
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
          Wettkampf
        </h1>
      </header>
      <div className="space-y-5">
        <RacePlanner initialRaces={racesData} />
        <RacePredictions
          profile={{
            thresholdPaceSecPerKm: athlete?.thresholdPaceSecPerKm ?? null,
            ftpWatts: athlete?.ftpWatts ?? null,
            cssPer100m: athlete?.thresholdSwimPer100m ?? null,
            weightKg: athlete?.weightKg ?? null,
            ctl: loadSeries.current.ctl,
            runReference: resolveRunReference({
              thresholdPaceSecPerKm: athlete?.thresholdPaceSecPerKm ?? null,
              runs,
            }),
            riegelExponent: calibrateRiegelExponent(runs).exponent,
            bikeReference: bestBikeReference(
              loadActivities.map((a) => ({
                sport: a.sport,
                distanceKm: a.distanceKm,
                durationMin: a.durationMin,
                avgPower: a.avgPower,
              })),
            ),
          }}
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
