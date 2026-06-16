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
  await prisma.gearItem.deleteMany();
  await prisma.bodyMetric.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.trainingGoal.deleteMany();
  await prisma.raceEvent.deleteMany();
  await prisma.athleteProfile.deleteMany();

  await prisma.athleteProfile.create({
    data: {
      name: "Sven",
      heightCm: 182,
      weightKg: 76,
      ftpWatts: 240,
      thresholdHr: 168,
      thresholdPaceSecPerKm: 255,
      thresholdSwimPer100m: 95,
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

  // ~10 Wochen Trainingshistorie für Form-/Volumen-Graphen.
  const plan: { sport: string; dur: number; dist: number; load: number; offset: number }[] =
    [];
  for (let week = 0; week < 10; week++) {
    const base = -(week * 7);
    plan.push({ sport: "swim", dur: 50, dist: 2.4, load: 45, offset: base - 0 });
    plan.push({ sport: "bike", dur: 110, dist: 48, load: 95, offset: base - 2 });
    plan.push({ sport: "run", dur: 55, dist: 10.5, load: 62, offset: base - 3 });
    plan.push({ sport: "bike", dur: 75, dist: 32, load: 58, offset: base - 4 });
    plan.push({ sport: "run", dur: 80, dist: 15, load: 88, offset: base - 6 });
  }
  let actSeq = 0;
  for (const p of plan) {
    if (p.offset >= 0) continue; // nur Vergangenheit
    await prisma.actualActivity.create({
      data: {
        externalId: `seed-${actSeq++}`,
        source: "intervals",
        date: daysFromNow(p.offset),
        sport: p.sport,
        durationMin: p.dur,
        distanceKm: p.dist,
        distanceM: Math.round(p.dist * 1000),
        load: p.load,
        avgHr: 138 + Math.round(p.load / 6),
      },
    });
  }

  // Wettkämpfe (Saisonziele).
  await prisma.raceEvent.create({
    data: {
      name: "Sprint-Triathlon Saisonstart",
      date: daysFromNow(35),
      type: "triathlon",
      distance: "sprint",
      priority: "C",
      notes: "Formtest",
    },
  });
  await prisma.raceEvent.create({
    data: {
      name: "Olympische Distanz Cup",
      date: daysFromNow(70),
      type: "triathlon",
      distance: "olympic",
      priority: "B",
    },
  });

  // Sportgeräte: Laufschuh + Rad mit Komponente (Kette).
  await prisma.gearItem.create({
    data: {
      name: "Nike Vaporfly 3",
      type: "shoe",
      sport: "run",
      brand: "Nike",
      purchaseDate: daysFromNow(-80),
      autoTrack: true,
      alertKm: 600,
    },
  });
  const bike = await prisma.gearItem.create({
    data: {
      name: "Canyon Speedmax",
      type: "bike",
      sport: "bike",
      brand: "Canyon",
      purchaseDate: daysFromNow(-400),
      autoTrack: true,
    },
  });
  await prisma.gearItem.create({
    data: {
      name: "Kette KMC X11",
      type: "component",
      sport: "bike",
      brand: "KMC",
      parentId: bike.id,
      purchaseDate: daysFromNow(-45),
      autoTrack: true,
      alertKm: 4000,
    },
  });

  await prisma.journalEntry.create({
    data: {
      date: daysFromNow(-1),
      mood: 4,
      text: "Lockerer Lauf, Achillessehne unauffällig. Beine fühlten sich frisch an.",
    },
  });

  // Körpermetriken (Gewicht + Ruhepuls) der letzten zwei Wochen.
  for (let i = 14; i >= 0; i -= 2) {
    await prisma.bodyMetric.create({
      data: {
        date: daysFromNow(-i),
        weightKg: Math.round((76 - i * 0.05) * 10) / 10,
        restingHr: 48 + (i % 3),
      },
    });
  }

  // Wochenziele je Disziplin (Minuten).
  await prisma.trainingGoal.createMany({
    data: [
      { sport: "swim", weeklyTargetMin: 120 },
      { sport: "bike", weeklyTargetMin: 300 },
      { sport: "run", weeklyTargetMin: 180 },
    ],
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
