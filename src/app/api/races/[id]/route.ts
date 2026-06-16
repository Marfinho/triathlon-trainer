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

  const data: Record<string, unknown> = {};
  if (typeof body.completed === "boolean") data.completed = body.completed;
  if (typeof body.resultSeconds === "number") data.resultSeconds = Math.round(body.resultSeconds);
  else if (body.resultSeconds === null) data.resultSeconds = null;
  if (typeof body.resultPlacement === "number") data.resultPlacement = Math.round(body.resultPlacement);
  if (typeof body.resultNote === "string") data.resultNote = body.resultNote;

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
  await prisma.raceEvent.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
