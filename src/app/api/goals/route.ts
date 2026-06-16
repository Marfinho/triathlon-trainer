import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * GET  /api/goals  – alle Wochenziele.
 * POST /api/goals  – Ziel je Disziplin anlegen/aktualisieren (Upsert).
 *                    Body: { sport, weeklyTargetMin }
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const goals = await prisma.trainingGoal.findMany({
    where: { userId },
    orderBy: { sport: "asc" },
  });
  return NextResponse.json({ goals });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const sport = typeof body.sport === "string" ? body.sport : "";
  const target =
    typeof body.weeklyTargetMin === "number" ? Math.round(body.weeklyTargetMin) : NaN;
  if (!sport || Number.isNaN(target) || target < 0) {
    return NextResponse.json(
      { ok: false, error: "sport und weeklyTargetMin erforderlich." },
      { status: 400 },
    );
  }

  const goal = await prisma.trainingGoal.upsert({
    where: { userId_sport: { userId, sport } },
    create: { userId, sport, weeklyTargetMin: target },
    update: { weeklyTargetMin: target },
  });
  return NextResponse.json({ ok: true, goal });
}

export async function DELETE(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const url = new URL(request.url);
  const sport = url.searchParams.get("sport");
  if (sport) {
    await prisma.trainingGoal
      .deleteMany({ where: { userId, sport } })
      .catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
