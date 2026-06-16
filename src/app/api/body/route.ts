import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * POST /api/body – Körpermetrik erfassen (neuer Datensatz, nichts überschrieben).
 * Body: { date?, weightKg?, restingHr?, notes? }
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

  const weightKg = typeof body.weightKg === "number" ? body.weightKg : null;
  const restingHr =
    typeof body.restingHr === "number" ? Math.round(body.restingHr) : null;
  if (weightKg == null && restingHr == null) {
    return NextResponse.json(
      { ok: false, error: "Gewicht oder Ruhepuls erforderlich." },
      { status: 400 },
    );
  }

  const date =
    typeof body.date === "string" && body.date
      ? new Date(`${body.date.slice(0, 10)}T00:00:00Z`)
      : new Date();

  const entry = await prisma.bodyMetric.create({
    data: {
      userId,
      date,
      weightKg,
      restingHr,
      notes: typeof body.notes === "string" ? body.notes : null,
    },
  });

  return NextResponse.json({ ok: true, id: entry.id });
}
