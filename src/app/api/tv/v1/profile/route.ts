import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOrDevice } from "@/lib/device/auth";
import { tvProfile } from "@/lib/tv/sections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tv/v1/profile – Profil, Schwellenwerte, Wochenziele, verbundene Dienste. */
export async function GET(request: Request) {
  const auth = await requireUserOrDevice(request);
  if (auth.response) return auth.response;
  return NextResponse.json(await tvProfile(auth.userId), { headers: { "Cache-Control": "no-store" } });
}

/** Mit der Fernbedienung einstellbare Werte und ihre Grenzen. */
const FIELDS = {
  ftpWatts: { min: 50, max: 600, int: true },
  thresholdHr: { min: 80, max: 230, int: true },
  weightKg: { min: 30, max: 250, int: false },
} as const;

/**
 * PATCH /api/tv/v1/profile – Schwellenwerte am Fernseher anpassen.
 * Body: Teilmenge von { ftpWatts, thresholdHr, weightKg } (Zahl oder null).
 */
export async function PATCH(request: Request) {
  const auth = await requireUserOrDevice(request);
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });

  const data: Record<string, number | null> = {};
  for (const [key, rule] of Object.entries(FIELDS)) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v === null) {
      data[key] = null;
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v) || v < rule.min || v > rule.max) {
      return NextResponse.json({ ok: false, error: `${key} muss zwischen ${rule.min} und ${rule.max} liegen.` }, { status: 400 });
    }
    data[key] = rule.int ? Math.round(v) : Math.round(v * 10) / 10;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ ok: false, error: "Keine Felder." }, { status: 400 });

  const existing = await prisma.athleteProfile.findFirst({ where: { userId: auth.userId }, orderBy: { createdAt: "asc" } });
  if (existing) {
    await prisma.athleteProfile.update({ where: { id: existing.id }, data });
  } else {
    const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });
    await prisma.athleteProfile.create({ data: { userId: auth.userId, name: user?.name ?? "Athlet", ...data } });
  }
  return NextResponse.json({ ok: true, profile: await tvProfile(auth.userId) });
}
