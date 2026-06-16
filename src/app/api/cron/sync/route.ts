import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLimits } from "@/lib/plan-limits";
import { decryptApiKey } from "@/lib/crypto";
import { HttpIntervalsClient } from "@/integrations/intervals/client";
import { processSyncQueue } from "@/integrations/intervals/syncQueue";
import { importActivitiesFromIntervals } from "@/integrations/intervals/importActivities";
import { isSyncDue } from "@/lib/sync-schedule";

/**
 * GET /api/cron/sync – von außen (Cron) getriggert. Gesichert per CRON_SECRET
 * (Bearer-Token), KEIN Session-Check.
 *
 * Für jeden User mit aktiver Intervals-Integration:
 *  - prüft das plan-abhängige Sync-Intervall gegen den letzten Sync-Log
 *  - falls fällig: Aktivitäten pullen + geplante Workouts pushen
 *  - schreibt einen SyncLog (type="sync", status, durationMs)
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integrations = await prisma.userIntegration.findMany({
    where: { provider: "intervals", enabled: true },
    include: { user: { select: { id: true, plan: true } } },
  });

  let processed = 0;
  let skipped = 0;
  const errors: { userId: string; error: string }[] = [];
  const now = new Date();

  for (const integration of integrations) {
    const userId = integration.userId;
    const plan = integration.user.plan;
    const intervalMin = getLimits(plan).syncIntervalMinutes;

    // Frequenz prüfen: letzter erfolgreicher Sync.
    const lastSync = await prisma.syncLog.findFirst({
      where: { userId, type: "sync" },
      orderBy: { createdAt: "desc" },
    });
    if (!isSyncDue(lastSync?.createdAt ?? null, intervalMin, now)) {
      skipped++;
      continue;
    }

    if (!integration.athleteId) {
      skipped++;
      continue;
    }

    const start = Date.now();
    try {
      const client = new HttpIntervalsClient({
        athleteId: integration.athleteId,
        apiKey: decryptApiKey(integration.apiKey),
        baseUrl: process.env.INTERVALS_API_BASE_URL,
      });
      await importActivitiesFromIntervals({ db: prisma, client, userId });
      await processSyncQueue({ db: prisma, client, userId, triggeredBy: "cron" });

      await prisma.syncLog.create({
        data: {
          userId,
          type: "sync",
          status: "success",
          durationMs: Date.now() - start,
          triggeredBy: "cron",
          success: true,
        },
      });
      processed++;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync fehlgeschlagen";
      await prisma.syncLog.create({
        data: {
          userId,
          type: "sync",
          status: "failed",
          durationMs: Date.now() - start,
          triggeredBy: "cron",
          success: false,
          errorMessage: message,
        },
      });
      errors.push({ userId, error: message });
    }
  }

  return NextResponse.json({ processed, skipped, errors });
}
