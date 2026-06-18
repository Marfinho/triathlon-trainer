import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { activitiesToCsv } from "@/domain/export/csv";

/**
 * GET /api/export?format=json|csv
 *   - json: vollständiger Datenexport (Download).
 *   - csv:  Ist-Aktivitäten als CSV (Download).
 *
 * Rein lesend – ändert nichts.
 */
export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const format = new URL(request.url).searchParams.get("format") ?? "json";
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const activities = await prisma.actualActivity.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });
    const csv = activitiesToCsv(activities);
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
    prisma.athleteProfile.findMany({ where: { userId } }),
    prisma.raceEvent.findMany({ where: { userId } }),
    prisma.plannedWorkout.findMany({ where: { userId } }),
    prisma.actualActivity.findMany({ where: { userId } }),
    prisma.trainingPlanImport.findMany({ where: { userId } }),
    prisma.coachSummaryExport.findMany({ where: { userId } }),
    prisma.intervalsWorkoutSync.findMany({ where: { userId } }),
    prisma.syncLog.findMany({ where: { userId } }),
    prisma.readinessSnapshot.findMany({ where: { userId } }),
    prisma.painSnapshot.findMany({ where: { userId } }),
    prisma.gearItem.findMany({ where: { userId } }),
    prisma.trainingGoal.findMany({ where: { userId } }),
    prisma.bodyMetric.findMany({ where: { userId } }),
    prisma.journalEntry.findMany({ where: { userId } }),
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
