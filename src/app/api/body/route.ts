import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { sanitizeOptionalText } from "@/domain/security/sanitize";

/**
 * POST /api/body – Körpermetrik erfassen (neuer Datensatz, nichts überschrieben).
 * Body: { date?, weightKg?, restingHr?, hrv?, notes? }
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

  // Nur endliche Zahlen (NaN/Infinity bestehen `typeof === "number"`).
  const finite = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const weightKg = finite(body.weightKg);
  const restingHrRaw = finite(body.restingHr);
  const restingHr = restingHrRaw != null ? Math.round(restingHrRaw) : null;
  const hrvRaw = finite(body.hrv);
  const hrv = hrvRaw != null ? Math.round(hrvRaw) : null;
  if (weightKg == null && restingHr == null && hrv == null) {
    return NextResponse.json(
      { ok: false, error: "Gewicht, Ruhepuls oder HRV erforderlich." },
      { status: 400 },
    );
  }

  // Datum validieren – ungültige Eingaben fallen auf "jetzt" zurück statt 500.
  let date = new Date();
  if (typeof body.date === "string" && body.date) {
    const parsed = new Date(`${body.date.slice(0, 10)}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  const entry = await prisma.bodyMetric.create({
    data: {
      userId,
      date,
      weightKg,
      restingHr,
      hrv,
      notes: sanitizeOptionalText(body.notes, 2000),
    },
  });

  return NextResponse.json({ ok: true, id: entry.id });
}
