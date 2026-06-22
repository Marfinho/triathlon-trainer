import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { sanitizeOptionalText } from "@/domain/security/sanitize";

/**
 * GET /api/races/:id/nutrition – Verpflegungsplan eines Rennens (oder null).
 * PUT /api/races/:id/nutrition – Verpflegungsplan anlegen/aktualisieren (1:1 je Rennen).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const { id } = await params;
  const race = await prisma.raceEvent.findFirst({ where: { id, userId } });
  if (!race) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plan = await prisma.raceNutritionPlan.findUnique({ where: { raceEventId: id } });
  return NextResponse.json({ plan });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const { id } = await params;
  const race = await prisma.raceEvent.findFirst({ where: { id, userId } });
  if (!race) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const toIntOrNull = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;

  const data = {
    carbsGPerHour: toIntOrNull(body.carbsGPerHour),
    fluidMlPerHour: toIntOrNull(body.fluidMlPerHour),
    sodiumMgPerHour: toIntOrNull(body.sodiumMgPerHour),
    caffeineMg: toIntOrNull(body.caffeineMg),
    bikeCarbsGPerHour: toIntOrNull(body.bikeCarbsGPerHour),
    runCarbsGPerHour: toIntOrNull(body.runCarbsGPerHour),
    notes: sanitizeOptionalText(body.notes, 2000),
    checklistJson: Array.isArray(body.checklist)
      ? (body.checklist.slice(0, 200) as Prisma.InputJsonValue)
      : Prisma.JsonNull,
  };

  const plan = await prisma.raceNutritionPlan.upsert({
    where: { raceEventId: id },
    create: { userId, raceEventId: id, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true, plan });
}
