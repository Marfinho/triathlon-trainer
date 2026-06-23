import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { sanitizeOptionalText } from "@/domain/security/sanitize";

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
  const str = (k: string, maxLen: number) => {
    if (typeof body[k] === "string") data[k] = sanitizeOptionalText(body[k], maxLen);
  };
  const finite = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const numField = (k: string) => {
    if (body[k] === null) data[k] = null;
    else if (finite(body[k]) != null) data[k] = body[k];
  };

  // `name` ist Pflichtfeld – ein leeres Ergebnis nach Sanitisierung würde die
  // DB-Constraint verletzen, daher wird ein solcher Wert ignoriert statt
  // gespeichert (kein Crash, kein versehentliches Leeren des Namens).
  if (typeof body.name === "string") {
    const cleaned = sanitizeOptionalText(body.name, 200);
    if (cleaned) data.name = cleaned;
  }
  str("brand", 120);
  str("model", 120);
  str("notes", 2000);
  numField("alertKm");
  numField("alertHours");
  if (typeof body.retired === "boolean") data.retired = body.retired;
  if (typeof body.autoTrack === "boolean") data.autoTrack = body.autoTrack;
  if (finite(body.manualKm) != null) data.manualKm = body.manualKm;
  if (finite(body.manualHours) != null) data.manualHours = body.manualHours;

  if (finite(body.addKm) != null) {
    data.manualKm = current.manualKm + (body.addKm as number);
  }
  if (finite(body.addHours) != null) {
    data.manualHours = current.manualHours + (body.addHours as number);
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
  try {
    await prisma.gearItem.delete({ where: { id } });
  } catch {
    return NextResponse.json({ ok: false, error: "Löschen fehlgeschlagen." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
