import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** DELETE /api/races/:id – Rennen entfernen. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.raceEvent.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
