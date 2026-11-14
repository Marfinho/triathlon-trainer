import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { createRaceForUser } from "@/domain/races/raceService";

/**
 * GET  /api/races  – kommende & jüngst vergangene Rennen (chronologisch).
 * POST /api/races  – neues Rennen anlegen.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const races = await prisma.raceEvent.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });
  return NextResponse.json({ races });
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

  const result = await createRaceForUser(userId, user.plan, body);
  if (!result.ok) {
    if (result.error === "LIMIT_REACHED") {
      return NextResponse.json(
        { error: "LIMIT_REACHED", limit: result.limit, current: result.current, tier: result.tier },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { ok: false, error: result.error === "INVALID" ? result.message : "Nicht gefunden." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, race: result.race });
}
