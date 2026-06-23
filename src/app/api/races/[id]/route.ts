import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * PATCH /api/races/:id – Ergebnis/Status setzen.
 * Body: { completed?, resultSeconds?, resultPlacement?, resultNote? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const existing = await prisma.raceEvent.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Nur endliche Zahlen (NaN/Infinity bestehen `typeof === "number"`).
  const finite = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const data: Record<string, unknown> = {};
  if (typeof body.completed === "boolean") data.completed = body.completed;
  if (body.resultSeconds === null) data.resultSeconds = null;
  else if (finite(body.resultSeconds) != null)
    data.resultSeconds = Math.round(body.resultSeconds as number);
  if (finite(body.resultPlacement) != null)
    data.resultPlacement = Math.round(body.resultPlacement as number);
  if (typeof body.resultNote === "string") data.resultNote = body.resultNote.slice(0, 2000);

  const race = await prisma.raceEvent.update({ where: { id }, data }).catch(() => null);
  if (!race) return NextResponse.json({ ok: false, error: "Nicht gefunden." }, { status: 404 });
  return NextResponse.json({ ok: true, race });
}


/** DELETE /api/races/:id – Rennen entfernen. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const { id } = await params;
  const existing = await prisma.raceEvent.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    await prisma.raceEvent.delete({ where: { id } });
  } catch {
    return NextResponse.json({ ok: false, error: "Löschen fehlgeschlagen." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
