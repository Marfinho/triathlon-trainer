/**
 * Seed-Daten für die lokale Entwicklung.
 *
 * Legt ein Athleten-Profil, ein Beispielrennen sowie ein paar geplante Workouts
 * und Ist-Aktivitäten an, damit das Dashboard direkt etwas anzeigt. Idempotent:
 * vorhandene Daten werden vorher gelöscht.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysFromNow(offset: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

async function main() {
  // Aufräumen (Reihenfolge wegen Relationen)
  await prisma.syncLog.deleteMany();
  await prisma.syncQueue.deleteMany();
  await prisma.intervalsWorkoutSync.deleteMany();
  await prisma.plannedWorkout.deleteMany();
  await prisma.trainingPlanImport.deleteMany();
  await prisma.actualActivity.deleteMany();
  await prisma.coachSummaryExport.deleteMany();
  await prisma.readinessSnapshot.deleteMany();
  await prisma.painSnapshot.deleteMany();
  await prisma.raceEvent.deleteMany();
  await prisma.athleteProfile.deleteMany();

  await prisma.athleteProfile.create({
    data: {
      name: "Sven",
      heightCm: 182,
      weightKg: 76,
      ftpWatts: 240,
      trainingLevel: "intermediate",
      primarySports: JSON.stringify(["run", "bike", "swim"]),
      knownLimiters: JSON.stringify(["achilles", "swim_technique"]),
      equipment: JSON.stringify({ bike: "road", powerMeter: true, pool: "25m" }),
    },
  });

  await prisma.raceEvent.create({
    data: {
      name: "Ironman 70.3 Beispielstadt",
      date: daysFromNow(120),
      type: "triathlon",
      distance: "70.3",
      priority: "A",
      notes: "Saisonhighlight",
    },
  });

  // Eine bereits abgeschlossene Einheit (geschützt!) und zwei offene.
  await prisma.plannedWorkout.create({
    data: {
      date: daysFromNow(-1),
      sport: "run",
      title: "Lockerer Dauerlauf",
      plannedDurationMin: 45,
      plannedDistanceM: 8000,
      rpe: 3,
      status: "completed",
      source: "plan_import",
      segmentsJson: JSON.stringify([]),
    },
  });

  await prisma.plannedWorkout.create({
    data: {
      date: daysFromNow(1),
      sport: "bike",
      title: "GA1 Radausfahrt",
      plannedDurationMin: 90,
      plannedDistanceM: 40000,
      rpe: 3,
      status: "planned",
      source: "plan_import",
      segmentsJson: JSON.stringify([
        {
          type: "steady",
          durationSec: 5400,
          distanceM: null,
          intensity: "endurance",
          targetType: "rpe",
          targetValue: 3,
          targetValueTo: null,
          cadenceNote: "85-95 rpm",
          rpeTarget: 3,
          description: "Gleichmäßig im GA1",
        },
      ]),
    },
  });

  await prisma.plannedWorkout.create({
    data: {
      date: daysFromNow(2),
      sport: "swim",
      title: "Techniktraining",
      plannedDurationMin: 45,
      plannedDistanceM: 2000,
      rpe: 2,
      status: "planned",
      source: "plan_import",
      segmentsJson: JSON.stringify([]),
    },
  });

  // Ist-Aktivität aus Intervals.icu (Spiegel).
  await prisma.actualActivity.create({
    data: {
      externalId: "demo-act-1",
      source: "intervals",
      date: daysFromNow(-1),
      sport: "run",
      durationMin: 47,
      distanceKm: 8.2,
      distanceM: 8200,
      load: 52,
      rpe: 3,
      avgHr: 142,
      notes: "Fühlte sich gut an",
    },
  });

  await prisma.readinessSnapshot.create({
    data: {
      date: daysFromNow(0),
      status: "green",
      sleepTrend: "stable",
      hrvTrend: "up",
      restingHrTrend: "stable",
      subjectiveFatigue: 2,
      notes: "Erholt",
    },
  });

  await prisma.painSnapshot.create({
    data: {
      date: daysFromNow(0),
      overall: 1,
      knee: 0,
      achilles: 2,
      calf: 0,
      back: 0,
      notes: "Achilles leicht spürbar",
    },
  });

  console.log("Seed abgeschlossen.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
