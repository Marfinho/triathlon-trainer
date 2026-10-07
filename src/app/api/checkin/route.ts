import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { createCheckin } from "@/lib/checkin";

/**
 * POST /api/checkin – Tages-Check-in: legt einen Readiness- und/oder
 * Pain-Snapshot an (jeweils neuer Datensatz, nichts wird überschrieben).
 *
 * Body: {
 *   date?, readiness?: { status, sleepTrend, hrvTrend, restingHrTrend, subjectiveFatigue, notes },
 *   pain?: { overall, knee, achilles, calf, back, notes }
 * }
 */
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

  const result = await createCheckin(userId, body);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
