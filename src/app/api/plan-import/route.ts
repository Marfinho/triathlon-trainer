import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateLocalhubPlan } from "@/domain/plan-import/validateLocalhubPlan";
import { importLocalhubPlan } from "@/domain/plan-import/importLocalhubPlan";
import { parseIsoDate, addDays } from "@/domain/training/dates";
import type { ExistingWorkoutRef } from "@/domain/plan-import/validateLocalhubPlan";

/**
 * POST /api/plan-import
 *   - mode "validate" (Default): nur prüfen, keine DB-Änderung; Vorschau zurück.
 *   - mode "import": validieren und importieren (offene Workouts ersetzen,
 *     completed/Ist unangetastet, SyncQueue-Jobs anlegen).
 *
 * Body: { plan: <localhub_plan JSON | string>, mode?: "validate" | "import" }
 */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungültiger Request-Body (kein JSON)." },
      { status: 400 },
    );
  }

  // Plan kann als Objekt oder als JSON-String übergeben werden.
  let plan: unknown = body.plan;
  if (typeof plan === "string") {
    try {
      plan = JSON.parse(plan);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          errors: [
            { code: "INVALID_JSON", message: "Plan ist kein gültiges JSON." },
          ],
        },
        { status: 200 },
      );
    }
  }

  const mode = body.mode === "import" ? "import" : "validate";

  if (mode === "import") {
    const result = await importLocalhubPlan(plan, { triggeredBy: "ui_import" });
    return NextResponse.json({ ok: result.success, ...result });
  }

  // mode === "validate": Vorschau ohne DB-Änderung.
  const firstPass = validateLocalhubPlan(plan);
  let existingRefs: ExistingWorkoutRef[] = [];
  if (firstPass.meta) {
    const rangeStart = parseIsoDate(firstPass.meta.planStart);
    const rangeEndExclusive = addDays(parseIsoDate(firstPass.meta.planEnd), 1);
    const existing = await prisma.plannedWorkout.findMany({
      where: { date: { gte: rangeStart, lt: rangeEndExclusive } },
      select: { id: true, date: true, status: true, title: true },
    });
    existingRefs = existing.map((w) => ({
      id: w.id,
      date: w.date,
      status: w.status,
      title: w.title,
    }));
  }

  const result = validateLocalhubPlan(plan, { existingWorkouts: existingRefs });
  return NextResponse.json({
    ok: result.valid,
    errors: result.errors,
    meta: result.meta,
    protectedCount: result.protectedActivities.length,
    replaceableCount: result.replaceableWorkouts.length,
    entryCount: result.plan?.entries.length ?? 0,
  });
}
