import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { validatePlanForUser } from "@/domain/plan-import/validatePlanForUser";
import { importLocalhubPlan } from "@/domain/plan-import/importLocalhubPlan";
import {
  buildPlanPreview,
  inspectRawExerciseDefinitions,
  summarizePlanExercises,
} from "@/domain/plan-import/buildPlanPreview";
import { isExercise3d, renderFrameAny, renderThumbAny } from "@/domain/exercises/any";
import { instantSyncAfterImport } from "@/integrations/intervals/instantSync";

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
    const sync = result.success ? await instantSyncAfterImport(userId) : null;

    return NextResponse.json({ ok: result.success, ...result, sync });
  }

  // mode === "validate": Vorschau ohne DB-Änderung (nur lesende Queries).
  const { result, existingRefs } = await validatePlanForUser(plan, userId);

  // Eigene Übungen einzeln prüfen und für gültige Start-/Endbild rendern
  // (Engine-Ausgabe, Texte XML-escaped).
  const customExercisePreviews = inspectRawExerciseDefinitions(plan).map((c) => ({
    index: c.index,
    id: c.id,
    title: c.title,
    valid: c.valid,
    error: c.error,
    startSvg: c.definition ? renderFrameAny(c.definition, 0) : null,
    endSvg: c.definition
      ? isExercise3d(c.definition)
        ? renderThumbAny(c.definition)
        : renderFrameAny(c.definition, 3)
      : null,
  }));

  return NextResponse.json({
    ok: result.valid,
    errors: result.errors,
    warnings: result.warnings,
    exercises: result.plan ? summarizePlanExercises(result.plan) : null,
    customExercisePreviews,
    meta: result.meta,
    protectedCount: result.protectedActivities.length,
    replaceableCount: result.replaceableWorkouts.length,
    entryCount: result.plan?.entries.length ?? 0,
    days: result.plan ? buildPlanPreview(result.plan, existingRefs) : [],
  });
}
