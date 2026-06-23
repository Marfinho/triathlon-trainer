import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { sanitizeText } from "@/domain/security/sanitize";

/**
 * GET    /api/journal       – letzte Einträge.
 * POST   /api/journal       – neuen Eintrag anlegen ({ date?, mood?, text }).
 * DELETE /api/journal?id=…  – Eintrag löschen.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const entries = await prisma.journalEntry.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 30,
  });
  return NextResponse.json({ entries });
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

  const text = sanitizeText(body.text, 5000);
  if (!text) {
    return NextResponse.json({ ok: false, error: "Text erforderlich." }, { status: 400 });
  }

  let date = new Date();
  if (typeof body.date === "string" && body.date) {
    const parsed = new Date(`${body.date.slice(0, 10)}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  const mood =
    typeof body.mood === "number" && Number.isFinite(body.mood)
      ? Math.round(body.mood)
      : null;

  const entry = await prisma.journalEntry.create({
    data: {
      userId,
      date,
      mood,
      text,
    },
  });
  return NextResponse.json({ ok: true, entry });
}

export async function DELETE(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id fehlt." }, { status: 400 });
  const result = await prisma.journalEntry.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    return NextResponse.json({ ok: false, error: "Nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
