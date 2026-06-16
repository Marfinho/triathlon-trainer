import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET  /api/goals  – alle Wochenziele.
 * POST /api/goals  – Ziel je Disziplin anlegen/aktualisieren (Upsert).
 *                    Body: { sport, weeklyTargetMin }
 */
export async function GET() {
  const goals = await prisma.trainingGoal.findMany({ orderBy: { sport: "asc" } });
  return NextResponse.json({ goals });
}

export async function POST(request: Request) {
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
    where: { sport },
    create: { sport, weeklyTargetMin: target },
    update: { weeklyTargetMin: target },
  });
  return NextResponse.json({ ok: true, goal });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const sport = url.searchParams.get("sport");
  if (sport) {
    await prisma.trainingGoal.delete({ where: { sport } }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
