import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOrDevice } from "@/lib/device/auth";
import { SPORTS } from "@/domain/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/tv/v1/goals – Wochenziel je Disziplin setzen (Upsert). Body: { sport, weeklyTargetMin } (0–3000). */
export async function POST(request: Request) {
  const auth = await requireUserOrDevice(request);
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as { sport?: unknown; weeklyTargetMin?: unknown } | null;
  const sport = typeof body?.sport === "string" ? body.sport : "";
  const target = typeof body?.weeklyTargetMin === "number" ? Math.round(body.weeklyTargetMin) : NaN;
  if (!(SPORTS as readonly string[]).includes(sport) || !Number.isFinite(target) || target < 0 || target > 3000) {
    return NextResponse.json({ ok: false, error: "sport und weeklyTargetMin (0–3000) erforderlich." }, { status: 400 });
  }
  const goal = await prisma.trainingGoal.upsert({
    where: { userId_sport: { userId: auth.userId, sport } },
    create: { userId: auth.userId, sport, weeklyTargetMin: target },
    update: { weeklyTargetMin: target },
  });
  return NextResponse.json({ ok: true, goal: { sport: goal.sport, weeklyTargetMin: goal.weeklyTargetMin } });
}
