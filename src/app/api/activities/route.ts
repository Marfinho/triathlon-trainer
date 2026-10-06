import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { activityCreateData, parseActivityInput } from "@/lib/activity-input";

/**
 * POST /api/activities
 * Speichert eine (z.B. auf der Radrolle aufgezeichnete) Ist-Aktivität.
 * Ist-Aktivitäten sind unantastbar – diese Route legt nur NEUE Datensätze an.
 *
 * Body: { sport, date?, durationMin, distanceKm?, load?, avgHr?, avgPower?,
 *         rpe?, source?, notes?, samples? }
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungültiger Body." },
      { status: 400 },
    );
  }

  const parsed = parseActivityInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const created = await prisma.actualActivity.create({
    data: activityCreateData(userId, parsed.input, {
      source: parsed.input.source ?? "trainer",
    }),
  });

  return NextResponse.json({ ok: true, id: created.id });
}
