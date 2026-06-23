/**
 * Seed-Daten für die lokale Entwicklung.
 *
 * Legt mehrere Demo-User mit Athleten-Profil, Rennen, geplanten Workouts und
 * Ist-Aktivitäten an, damit das Dashboard direkt etwas anzeigt. Idempotent:
 * vorhandene Daten werden vorher gelöscht.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function daysFromNow(offset: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

type UserSeed = {
  email: string;
  name: string;
  role: "admin" | "user";
  weightKg: number;
  heightCm: number;
  ftpWatts: number;
  thresholdHr: number;
  thresholdPaceSecPerKm: number;
  thresholdSwimPer100m: number;
  primarySports: string[];
  raceName: string;
  raceType: "triathlon" | "run" | "bike" | "swim";
  raceDistance: string;
};

const USERS: UserSeed[] = [
  {
    email: "demo@localhub.app",
    name: "Sven",
    role: "admin",
    weightKg: 76,
    heightCm: 182,
    ftpWatts: 240,
    thresholdHr: 168,
    thresholdPaceSecPerKm: 255,
    thresholdSwimPer100m: 95,
    primarySports: ["run", "bike", "swim"],
    raceName: "Ironman 70.3 Beispielstadt",
    raceType: "triathlon",
    raceDistance: "70.3",
  },
  {
    email: "mara@localhub.app",
    name: "Mara",
    role: "user",
    weightKg: 61,
    heightCm: 168,
    ftpWatts: 190,
    thresholdHr: 178,
    thresholdPaceSecPerKm: 240,
    thresholdSwimPer100m: 105,
    primarySports: ["run", "swim"],
    raceName: "Berlin Marathon",
    raceType: "run",
    raceDistance: "marathon",
  },
  {
    email: "tom@localhub.app",
    name: "Tom",
    role: "user",
    weightKg: 82,
    heightCm: 188,
    ftpWatts: 280,
    thresholdHr: 162,
    thresholdPaceSecPerKm: 270,
    thresholdSwimPer100m: 110,
    primarySports: ["bike", "run"],
    raceName: "Alpen-Radmarathon",
    raceType: "bike",
    raceDistance: "olympic",
  },
];

async function seedUser(spec: UserSeed) {
  const user = await prisma.user.create({
    data: {
      email: spec.email,
      name: spec.name,
      passwordHash: await bcrypt.hash("password123", 10),
      provider: "credentials",
      role: spec.role,
    },
  });

  await prisma.athleteProfile.create({
    data: {
      userId: user.id,
      name: spec.name,
      heightCm: spec.heightCm,
      weightKg: spec.weightKg,
      ftpWatts: spec.ftpWatts,
      thresholdHr: spec.thresholdHr,
      thresholdPaceSecPerKm: spec.thresholdPaceSecPerKm,
      thresholdSwimPer100m: spec.thresholdSwimPer100m,
      trainingLevel: "intermediate",
      primarySports: spec.primarySports,
      knownLimiters: ["achilles", "swim_technique"],
      equipment: { bike: "road", powerMeter: true, pool: "25m" },
    },
  });

  await prisma.raceEvent.create({
    data: {
      userId: user.id,
      name: spec.raceName,
      date: daysFromNow(120),
      type: spec.raceType,
      distance: spec.raceDistance,
      priority: "A",
      notes: "Saisonhighlight",
    },
  });

  // Eine bereits abgeschlossene Einheit (geschützt!) und zwei offene.
  await prisma.plannedWorkout.create({
    data: {
      userId: user.id,
      date: daysFromNow(-1),
      sport: "run",
      title: "Lockerer Dauerlauf",
      plannedDurationMin: 45,
      plannedDistanceM: 8000,
      rpe: 3,
      status: "completed",
      source: "plan_import",
      segmentsJson: [],
    },
  });

  await prisma.plannedWorkout.create({
    data: {
      userId: user.id,
      date: daysFromNow(1),
      sport: "bike",
      title: "VO2max 4×4 Intervalle",
      plannedDurationMin: 57,
      plannedDistanceM: null,
      rpe: 7,
      status: "planned",
      source: "plan_import",
      segmentsJson: [
        {
          type: "warmup",
          durationSec: 900,
          distanceM: null,
          intensity: "warmup",
          targetType: "power",
          targetValue: Math.round(spec.ftpWatts * 0.55),
          targetValueTo: null,
          cadenceNote: "90-95 rpm",
          rpeTarget: 2,
          description: "Locker einrollen, am Ende 3× 15 s Antritte",
        },
        ...[1, 2, 3, 4].flatMap((n) => [
          {
            type: "vo2max",
            durationSec: 240,
            distanceM: null,
            intensity: "vo2max",
            targetType: "power",
            targetValue: Math.round(spec.ftpWatts * 1.1),
            targetValueTo: Math.round(spec.ftpWatts * 1.15),
            cadenceNote: "95-100 rpm",
            rpeTarget: 9,
            description: `Intervall ${n}/4 – konstant hart, gleichmäßig`,
          },
          {
            type: "recovery",
            durationSec: 240,
            distanceM: null,
            intensity: "recovery",
            targetType: "power",
            targetValue: Math.round(spec.ftpWatts * 0.5),
            targetValueTo: null,
            cadenceNote: "locker",
            rpeTarget: 2,
            description: `Erholung ${n}/4`,
          },
        ]),
        {
          type: "cooldown",
          durationSec: 600,
          distanceM: null,
          intensity: "cooldown",
          targetType: "power",
          targetValue: Math.round(spec.ftpWatts * 0.45),
          targetValueTo: null,
          cadenceNote: "ruhig ausdrehen",
          rpeTarget: 1,
          description: "Ausfahren",
        },
      ],
    },
  });

  await prisma.plannedWorkout.create({
    data: {
      userId: user.id,
      date: daysFromNow(2),
      sport: "swim",
      title: "Techniktraining",
      plannedDurationMin: 45,
      plannedDistanceM: 2000,
      rpe: 2,
      status: "planned",
      source: "plan_import",
      segmentsJson: [],
    },
  });

  // Ist-Aktivität aus Intervals.icu (Spiegel).
  await prisma.actualActivity.create({
    data: {
      userId: user.id,
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
      userId: user.id,
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
      userId: user.id,
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
        userId: user.id,
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
      userId: user.id,
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
      userId: user.id,
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
      userId: user.id,
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
      userId: user.id,
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
      userId: user.id,
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
      userId: user.id,
      date: daysFromNow(-1),
      mood: 4,
      text: "Lockerer Lauf, Achillessehne unauffällig. Beine fühlten sich frisch an.",
    },
  });

  // Körpermetriken (Gewicht + Ruhepuls) der letzten zwei Wochen.
  for (let i = 14; i >= 0; i -= 2) {
    await prisma.bodyMetric.create({
      data: {
        userId: user.id,
        date: daysFromNow(-i),
        weightKg: Math.round((spec.weightKg - i * 0.05) * 10) / 10,
        restingHr: 48 + (i % 3),
      },
    });
  }

  // Wochenziele je Disziplin (Minuten).
  await prisma.trainingGoal.createMany({
    data: [
      { userId: user.id, sport: "swim", weeklyTargetMin: 120 },
      { userId: user.id, sport: "bike", weeklyTargetMin: 300 },
      { userId: user.id, sport: "run", weeklyTargetMin: 180 },
    ],
  });

  return user;
}

async function main() {
  // Aufräumen: User-Löschung kaskadiert auf alle Domänen-Tabellen.
  await prisma.user.deleteMany();

  for (const spec of USERS) {
    const user = await seedUser(spec);
    console.log(`Seed: ${user.email} (${spec.role}) angelegt.`);
  }

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
