import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOrDevice } from "@/lib/device/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/tv/v1/logout – das Gerät widerruft seinen eigenen Token ("Abmelden"). */
export async function POST(request: Request) {
  const auth = await requireUserOrDevice(request);
  if (auth.response) return auth.response;
  if (auth.via !== "device" || !auth.tokenId) {
    return NextResponse.json({ ok: false, error: "Nur mit Geräte-Token." }, { status: 400 });
  }
  await prisma.deviceToken.updateMany({
    where: { id: auth.tokenId, userId: auth.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
