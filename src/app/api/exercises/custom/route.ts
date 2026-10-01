import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { checkSingleExercise, saveSingleExercise } from "@/domain/exercises/singleExercise";
import { frameLabels, musclesOf, renderFaultAny, renderFrameAny, renderHeroAny } from "@/domain/exercises/any";

/**
 * POST /api/exercises/custom – einzelne eigene Übung (z. B. von einer KI).
 *   - mode "validate" (Default): prüfen, Vorschau-Bilder zurück, keine DB-Änderung.
 *   - mode "save": erneut prüfen und für den angemeldeten Nutzer speichern
 *     (erst nach Klick auf „Übung übernehmen“).
 * Body: { definition: <JSON-Objekt | String>, mode?: "validate" | "save" }
 * Vorschau-SVGs sind ausschließlich Engine-Ausgabe (Texte XML-escaped).
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Request-Body (kein JSON)." }, { status: 400 });
  }

  if (body.mode === "save") {
    const result = await saveSingleExercise(user.userId, body.definition);
    return NextResponse.json(result);
  }

  const check = checkSingleExercise(body.definition);
  const def = check.definition;
  const preview =
    def // auch bei Posenfehlern zeigen – so sieht man, was nicht passt
      ? {
          id: def.id,
          title: def.title,
          subtitle: def.subtitle,
          heroSvg: renderHeroAny(def),
          muscles: musclesOf(def).map((m) => ({ label: m.label, role: m.role })),
          frames: frameLabels(def).map((label, i) => ({ label, svg: renderFrameAny(def, i) })),
          fault: renderFaultAny(def),
        }
      : null;
  return NextResponse.json({ ok: check.errors.length === 0, errors: check.errors, warnings: check.warnings, preview });
}
