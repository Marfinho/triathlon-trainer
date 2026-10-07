import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { sanitizeOptionalText } from "@/domain/security/sanitize";

/**
 * Tages-Check-in: legt einen Readiness- und/oder Pain-Snapshot an (jeweils
 * neuer Datensatz, nichts wird überschrieben). Gemeinsam genutzt von
 * POST /api/checkin (Web) und POST /api/tv/v1/checkin (Fire-TV-App).
 */
export async function createCheckin(
  userId: string,
  body: Record<string, unknown>,
  db: Pick<PrismaClient, "readinessSnapshot" | "painSnapshot"> = defaultPrisma,
): Promise<{ ok: true; created: { readiness?: string; pain?: string } } | { ok: false; error: string }> {
  const prisma = db;
  let date = new Date();
  if (typeof body.date === "string" && body.date) {
    const parsed = new Date(`${body.date.slice(0, 10)}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  const r = (body.readiness ?? null) as Record<string, unknown> | null;
  const p = (body.pain ?? null) as Record<string, unknown> | null;

  const intOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
  const strOrNull = (v: unknown): string | null =>
    typeof v === "string" && v ? v : null;
  const notesOrNull = (v: unknown): string | null => sanitizeOptionalText(v, 2000);

  const created: { readiness?: string; pain?: string } = {};

  if (r) {
    const snap = await prisma.readinessSnapshot.create({
      data: {
        userId,
        date,
        status: strOrNull(r.status),
        sleepTrend: strOrNull(r.sleepTrend),
        hrvTrend: strOrNull(r.hrvTrend),
        restingHrTrend: strOrNull(r.restingHrTrend),
        subjectiveFatigue: intOrNull(r.subjectiveFatigue),
        notes: notesOrNull(r.notes),
      },
    });
    created.readiness = snap.id;
  }

  if (p) {
    const snap = await prisma.painSnapshot.create({
      data: {
        userId,
        date,
        overall: intOrNull(p.overall),
        knee: intOrNull(p.knee),
        achilles: intOrNull(p.achilles),
        calf: intOrNull(p.calf),
        back: intOrNull(p.back),
        notes: notesOrNull(p.notes),
      },
    });
    created.pain = snap.id;
  }

  if (!created.readiness && !created.pain) {
    return { ok: false, error: "Keine Daten übergeben." };
  }

  return { ok: true, created };
}
