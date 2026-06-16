import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { validateLocalhubPlan } from "@/domain/plan-import/validateLocalhubPlan";
import { importLocalhubPlan } from "@/domain/plan-import/importLocalhubPlan";
import { parseIsoDate, addDays } from "@/domain/training/dates";
import type { ExistingWorkoutRef } from "@/domain/plan-import/validateLocalhubPlan";
import { processSyncQueue } from "@/integrations/intervals/syncQueue";
import { createIntervalsClientForUser } from "@/integrations/intervals/userClient";

/**
 * POST /api/plan-import
 *   - mode "validate" (Default): nur prüfen, keine DB-Änderung; Vorschau zurück.
 *   - mode "import": validieren und importieren (offene Workouts ersetzen,
 *     completed/Ist unangetastet). Anschließend werden die erzeugten
 *     SyncQueue-Jobs SOFORT nach Intervals.icu gepusht (sofern konfiguriert) –
 *     neue Workouts werden angelegt, ersetzte Events entfernt.
 *
 * Body: { plan: <localhub_plan JSON | string>, mode?: "validate" | "import" }
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
    const result = await importLocalhubPlan(plan, {
      userId,
      triggeredBy: "ui_import",
    });

    // Instant-Sync: erzeugte/ersetzte Workouts sofort nach Intervals.icu pushen.
    let sync: Record<string, unknown> | null = null;
    if (result.success) {
      const client = await createIntervalsClientForUser(userId);
      if (!client) {
        sync = {
          skipped: true,
          reason: "Intervals.icu nicht konfiguriert",
        };
      } else {
        try {
          const res = await processSyncQueue({
            db: prisma,
            client,
            userId,
            triggeredBy: "import_autosync",
          });
          sync = { ...res };
        } catch (e) {
          sync = { error: e instanceof Error ? e.message : "Sync fehlgeschlagen" };
        }
      }
    }

    return NextResponse.json({ ok: result.success, ...result, sync });
  }

  // mode === "validate": Vorschau ohne DB-Änderung.
  const firstPass = validateLocalhubPlan(plan);
  let existingRefs: ExistingWorkoutRef[] = [];
  if (firstPass.meta) {
    const rangeStart = parseIsoDate(firstPass.meta.planStart);
    const rangeEndExclusive = addDays(parseIsoDate(firstPass.meta.planEnd), 1);
    const existing = await prisma.plannedWorkout.findMany({
      where: { userId, date: { gte: rangeStart, lt: rangeEndExclusive } },
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
