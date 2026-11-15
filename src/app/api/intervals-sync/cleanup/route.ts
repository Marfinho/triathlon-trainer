import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { createIntervalsClientForUser } from "@/integrations/intervals/userClient";
import { reconcileIntervalsEvents } from "@/integrations/intervals/reconcile";

/**
 * POST /api/intervals-sync/cleanup – entfernt veraltete und doppelte Einträge in Intervals.icu.
 * Body (optional): { dryRun?: boolean, includeForeign?: boolean }
 *   dryRun         nur anzeigen, was gelöscht würde
 *   includeForeign auch Einträge ohne LocalHub-Kennung löschen, die einen LocalHub-Eintrag duplizieren
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    /* leerer Body ist erlaubt */
  }

  const client = await createIntervalsClientForUser(user.userId);
  if (!client) {
    return NextResponse.json({ ok: false, error: "Intervals.icu ist nicht konfiguriert." }, { status: 400 });
  }
  try {
    const result = await reconcileIntervalsEvents({
      db: prisma,
      client,
      userId: user.userId,
      dryRun: body.dryRun === true,
      deleteForeignDuplicates: body.includeForeign === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Aufräumen fehlgeschlagen." },
      { status: 502 },
    );
  }
}
