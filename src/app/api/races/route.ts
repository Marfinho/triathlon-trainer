import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET  /api/races  – kommende & jüngst vergangene Rennen (chronologisch).
 * POST /api/races  – neues Rennen anlegen.
 */
export async function GET() {
  const races = await prisma.raceEvent.findMany({ orderBy: { date: "asc" } });
  return NextResponse.json({ races });
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const dateStr = typeof body.date === "string" ? body.date : "";
  if (!name || !dateStr) {
    return NextResponse.json(
      { ok: false, error: "Name und Datum sind erforderlich." },
      { status: 400 },
    );
  }

  const race = await prisma.raceEvent.create({
    data: {
      name,
      date: new Date(`${dateStr.slice(0, 10)}T00:00:00Z`),
      type: typeof body.type === "string" ? body.type : "triathlon",
      distance: typeof body.distance === "string" ? body.distance : null,
      priority: typeof body.priority === "string" ? body.priority : "B",
      notes: typeof body.notes === "string" ? body.notes : null,
    },
  });

  return NextResponse.json({ ok: true, race });
}
