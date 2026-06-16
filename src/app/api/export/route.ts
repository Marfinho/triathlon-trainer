import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/export?format=json|csv
 *   - json: vollständiges Backup aller Tabellen (Download).
 *   - csv:  Ist-Aktivitäten als CSV (Download).
 *
 * Rein lesend – ändert nichts.
 */
export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const activities = await prisma.actualActivity.findMany({
      orderBy: { date: "desc" },
    });
    const header = [
      "date",
      "sport",
      "durationMin",
      "distanceKm",
      "load",
      "avgHr",
      "source",
    ];
    const rows = activities.map((a) =>
      [
        a.date.toISOString().slice(0, 10),
        a.sport,
        a.durationMin ?? "",
        a.distanceKm ?? "",
        a.load ?? "",
        a.avgHr ?? "",
        a.source,
      ].join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="localhub-aktivitaeten-${stamp}.csv"`,
      },
    });
  }

  const [
    athleteProfile,
    raceEvent,
    plannedWorkout,
    actualActivity,
    trainingPlanImport,
    coachSummaryExport,
    intervalsWorkoutSync,
    syncLog,
    readinessSnapshot,
    painSnapshot,
    gearItem,
    trainingGoal,
    bodyMetric,
    journalEntry,
  ] = await Promise.all([
    prisma.athleteProfile.findMany(),
    prisma.raceEvent.findMany(),
    prisma.plannedWorkout.findMany(),
    prisma.actualActivity.findMany(),
    prisma.trainingPlanImport.findMany(),
    prisma.coachSummaryExport.findMany(),
    prisma.intervalsWorkoutSync.findMany(),
    prisma.syncLog.findMany(),
    prisma.readinessSnapshot.findMany(),
    prisma.painSnapshot.findMany(),
    prisma.gearItem.findMany(),
    prisma.trainingGoal.findMany(),
    prisma.bodyMetric.findMany(),
    prisma.journalEntry.findMany(),
  ]);

  const backup = {
    schemaVersion: "1.0",
    exportedAt: new Date().toISOString(),
    data: {
      athleteProfile,
      raceEvent,
      plannedWorkout,
      actualActivity,
      trainingPlanImport,
      coachSummaryExport,
      intervalsWorkoutSync,
      syncLog,
      readinessSnapshot,
      painSnapshot,
      gearItem,
      trainingGoal,
      bodyMetric,
      journalEntry,
    },
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="localhub-backup-${stamp}.json"`,
    },
  });
}
