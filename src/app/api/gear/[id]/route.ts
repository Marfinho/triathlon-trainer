import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * PATCH  /api/gear/:id  – Gerät aktualisieren.
 *   Sonderfelder: `addKm` / `addHours` erhöhen die manuellen Werte (z.B. für
 *   eine Outdoor-Einheit), `resetUsage: true` setzt manuelle Werte auf 0 und das
 *   Kaufdatum auf heute (z.B. nach Kettenwechsel).
 * DELETE /api/gear/:id  – Gerät (und Komponenten via Cascade) löschen.
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

  const current = await prisma.gearItem.findFirst({ where: { id, userId } });
  if (!current) {
    return NextResponse.json({ ok: false, error: "Nicht gefunden." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  const str = (k: string) => {
    if (typeof body[k] === "string") data[k] = body[k];
  };
  const numField = (k: string) => {
    if (typeof body[k] === "number") data[k] = body[k];
    else if (body[k] === null) data[k] = null;
  };

  str("name");
  str("brand");
  str("model");
  str("notes");
  numField("alertKm");
  numField("alertHours");
  if (typeof body.retired === "boolean") data.retired = body.retired;
  if (typeof body.autoTrack === "boolean") data.autoTrack = body.autoTrack;
  if (typeof body.manualKm === "number") data.manualKm = body.manualKm;
  if (typeof body.manualHours === "number") data.manualHours = body.manualHours;

  if (typeof body.addKm === "number") {
    data.manualKm = current.manualKm + body.addKm;
  }
  if (typeof body.addHours === "number") {
    data.manualHours = current.manualHours + body.addHours;
  }
  if (body.resetUsage === true) {
    data.manualKm = 0;
    data.manualHours = 0;
    data.purchaseDate = new Date();
  }

  const updated = await prisma.gearItem.update({ where: { id }, data });
  return NextResponse.json({ ok: true, gear: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const { id } = await params;
  const existing = await prisma.gearItem.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.gearItem.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
