import { prisma } from "@/lib/db";
import { processSyncQueue } from "./syncQueue";
import { createIntervalsClientForUser } from "./userClient";
import { reconcileIntervalsEvents } from "./reconcile";

/**
 * Pusht die nach einem Planimport erzeugten SyncQueue-Jobs sofort nach
 * Intervals.icu (sofern für den Nutzer konfiguriert). Wirft nie – Fehler
 * kommen als `{ error }` zurück, damit der Import selbst nicht scheitert.
 */
export async function instantSyncAfterImport(
  userId: string,
): Promise<Record<string, unknown>> {
  const client = await createIntervalsClientForUser(userId);
  if (!client) {
    return { skipped: true, reason: "Intervals.icu nicht konfiguriert" };
  }
  try {
    const res = await processSyncQueue({
      db: prisma,
      client,
      userId,
      triggeredBy: "import_autosync",
    });
    // Veraltete/doppelte Einträge (z. B. fehlgeschlagene Lösch-Jobs) bereinigen.
    const cleanup = await reconcileIntervalsEvents({ db: prisma, client, userId })
      .then((r) => ({ deleted: r.deleted, failed: r.failed.length }))
      .catch((e) => ({ error: e instanceof Error ? e.message : "Aufräumen fehlgeschlagen" }));
    return { ...res, cleanup };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sync fehlgeschlagen" };
  }
}
