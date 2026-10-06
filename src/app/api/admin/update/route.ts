import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { recordAudit } from "@/lib/audit";
import { readUpdateView, requestUpdateAction } from "@/lib/system-update";

/**
 * GET  /api/admin/update – Stand des Updaters (aktuelle/neueste Version, Log).
 * POST /api/admin/update – { action: "check" | "update" } stößt Prüfung bzw.
 *      Update (git pull + Neubau der App) im Updater-Dienst an.
 */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  return NextResponse.json(await readUpdateView());
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "check" && action !== "update") {
    return NextResponse.json({ error: "Ungültige Aktion." }, { status: 400 });
  }

  const view = await readUpdateView();
  if (!view.available) {
    return NextResponse.json(
      { error: "Kein Updater-Dienst angebunden (nur im Docker-Compose-Betrieb verfügbar)." },
      { status: 501 },
    );
  }
  if (view.status?.state === "running" || view.status?.state === "checking") {
    return NextResponse.json({ error: "Es läuft bereits ein Vorgang." }, { status: 409 });
  }

  await requestUpdateAction(action);
  if (action === "update") {
    await recordAudit({ userId: user.userId, action: "admin_system_update_started" });
  }
  return NextResponse.json({ ok: true });
}
