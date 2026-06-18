import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { getEffectiveLimits } from "@/lib/plan-config";
import { sanitizeText, sanitizeOptionalText } from "@/domain/security/sanitize";

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

  const name = sanitizeText(body.name, 200);
  const dateStr = typeof body.date === "string" ? body.date : "";
  if (!name || !dateStr) {
    return NextResponse.json(
      { ok: false, error: "Name und Datum sind erforderlich." },
      { status: 400 },
    );
  }

  const limit = (await getEffectiveLimits(user.plan)).maxRaceEvents;
  if (Number.isFinite(limit)) {
    const current = await prisma.raceEvent.count({ where: { userId } });
    if (current >= limit) {
      return NextResponse.json(
        { error: "LIMIT_REACHED", limit, current, tier: user.plan },
        { status: 403 },
      );
    }
  }

  const race = await prisma.raceEvent.create({
    data: {
      userId,
      name,
      date: new Date(`${dateStr.slice(0, 10)}T00:00:00Z`),
      type: typeof body.type === "string" ? body.type : "triathlon",
      distance: sanitizeOptionalText(body.distance, 60),
      priority: typeof body.priority === "string" ? body.priority : "B",
      notes: sanitizeOptionalText(body.notes, 2000),
    },
  });

  return NextResponse.json({ ok: true, race });
}
