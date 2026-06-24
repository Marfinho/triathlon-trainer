import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { formatIsoDate, addDays } from "@/domain/training/dates";
import {
  buildLoadSeries,
  buildWeeklyVolume,
  interpretForm,
} from "@/domain/training/trainingLoad";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const todayStart = new Date(`${formatIsoDate(now)}T00:00:00.000Z`);
    const todayEnd = new Date(`${formatIsoDate(now)}T23:59:59.999Z`);
    const loadWindowStart = addDays(now, -90);

    const [
      todayPlanned,
      todayActual,
      recentActivities,
      recentReadiness,
      latestBodyMetric,
      activeGoals,
    ] = await Promise.all([
      prisma.plannedWorkout.findFirst({
        where: { userId: user.id, date: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.actualActivity.findFirst({
        where: { userId: user.id, date: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.actualActivity.findMany({
        where: { userId: user.id, date: { gte: loadWindowStart } },
        orderBy: { date: "desc" },
        take: 100,
      }),
      prisma.readinessSnapshot.findMany({
        where: { userId: user.id, date: { gte: addDays(now, -7) } },
        orderBy: { date: "desc" },
        take: 7,
      }),
      prisma.bodyMetric.findFirst({
        where: { userId: user.id },
        orderBy: { date: "desc" },
      }),
      prisma.trainingGoal.findMany({
        where: { userId: user.id },
        take: 5,
      }),
    ]);

    const loadSeries = buildLoadSeries(recentActivities, { today: now });
    const form = interpretForm(loadSeries.current.tsb);
    const weeklyVolume = buildWeeklyVolume(recentActivities, { today: now });

    return NextResponse.json({
      today: {
        dateIso: formatIsoDate(now),
        planned: todayPlanned,
        actual: todayActual,
      },
      training: {
        recentActivities,
        loadSeries,
        form,
        weeklyVolume,
      },
      readiness: {
        latest: recentReadiness[0] || null,
        history: recentReadiness,
      },
      body: {
        latestMetric: latestBodyMetric,
      },
      goals: {
        active: activeGoals,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/data error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
