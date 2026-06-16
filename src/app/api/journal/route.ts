import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET    /api/journal       – letzte Einträge.
 * POST   /api/journal       – neuen Eintrag anlegen ({ date?, mood?, text }).
 * DELETE /api/journal?id=…  – Eintrag löschen.
 */
export async function GET() {
  const entries = await prisma.journalEntry.findMany({
    orderBy: { date: "desc" },
    take: 30,
  });
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ ok: false, error: "Text erforderlich." }, { status: 400 });
  }

  const entry = await prisma.journalEntry.create({
    data: {
      date:
        typeof body.date === "string" && body.date
          ? new Date(`${body.date.slice(0, 10)}T00:00:00Z`)
          : new Date(),
      mood: typeof body.mood === "number" ? Math.round(body.mood) : null,
      text,
    },
  });
  return NextResponse.json({ ok: true, entry });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (id) await prisma.journalEntry.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
