import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOrDevice } from "@/lib/device/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/tv/v1/body – Körperwerte erfassen (neuer Eintrag). Body: { weightKg?, restingHr? }. */
export async function POST(request: Request) {
  const auth = await requireUserOrDevice(request);
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as { weightKg?: unknown; restingHr?: unknown } | null;
  const num = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
  const weightKg = num(body?.weightKg, 30, 250);
  const restingHr = num(body?.restingHr, 25, 150);
  if (weightKg == null && restingHr == null) {
    return NextResponse.json({ ok: false, error: "weightKg (30–250) oder restingHr (25–150) erforderlich." }, { status: 400 });
  }
  const row = await prisma.bodyMetric.create({
    data: {
      userId: auth.userId,
      date: new Date(),
      weightKg: weightKg != null ? Math.round(weightKg * 10) / 10 : null,
      restingHr: restingHr != null ? Math.round(restingHr) : null,
    },
  });
  return NextResponse.json({ ok: true, id: row.id });
}
