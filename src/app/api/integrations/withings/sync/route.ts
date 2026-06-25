import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { createWithingsClientForUser } from "@/integrations/withings/userClient";
import { importWithingsData } from "@/integrations/withings/importData";

/**
 * POST /api/integrations/withings/sync
 * Manueller Sync für einen User (UI-Button-Trigger).
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const client = await createWithingsClientForUser(userId);
  if (!client) {
    return NextResponse.json(
      {
        ok: false,
        error: "Withings ist nicht konfiguriert.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await importWithingsData({
      db: prisma,
      client,
      userId,
    });

    await prisma.syncLog.create({
      data: {
        userId,
        type: "integration",
        action: "withings_sync",
        success: true,
        reason: `Measurements: ${result.measurements.created}/${result.measurements.fetched}, Sleep: ${result.sleep.created}/${result.sleep.fetched}, Activities: ${result.activities.created}/${result.activities.fetched}`,
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Sync fehlgeschlagen.";

    await prisma.syncLog.create({
      data: {
        userId,
        type: "integration",
        action: "withings_sync",
        success: false,
        reason: errorMsg,
      },
    });

    return NextResponse.json(
      { ok: false, error: errorMsg },
      { status: 502 },
    );
  }
}
