import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/sync-queue – Übersicht der Sync-Queue
 * POST /api/admin/sync-queue – { jobId, action } führt Aktion aus (retry/cancel)
 *   Sammelaktionen ohne jobId: { action: "retry_failed" } setzt alle fehlgeschlagenen
 *   Jobs zurück auf pending (Versuche = 0); { action: "clear_failed" } löscht sie.
 */

export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);

  const where: Record<string, unknown> = {};
  if (status && ["pending", "processing", "success", "failed"].includes(status)) {
    where.status = status;
  }

  const [jobs, statusCounts] = await Promise.all([
    prisma.syncQueue.findMany({
      where,
      select: {
        id: true,
        userId: true,
        localWorkoutId: true,
        action: true,
        status: true,
        attempts: true,
        lastAttemptAt: true,
        nextAttemptAt: true,
        errorMessage: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.syncQueue.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  const counts = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count]),
  );

  return NextResponse.json({ jobs, counts });
}

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "retry_failed") {
    const r = await prisma.syncQueue.updateMany({
      where: { status: "failed" },
      data: { status: "pending", attempts: 0, nextAttemptAt: new Date(), errorMessage: null },
    });
    return NextResponse.json({ ok: true, count: r.count });
  }
  if (action === "clear_failed") {
    const r = await prisma.syncQueue.deleteMany({ where: { status: "failed" } });
    return NextResponse.json({ ok: true, count: r.count });
  }

  if (!jobId || !["retry", "cancel"].includes(action)) {
    return NextResponse.json(
      { error: "jobId und action (retry|cancel) erforderlich (oder action retry_failed|clear_failed)." },
      { status: 400 },
    );
  }

  const job = await prisma.syncQueue.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: "Job nicht gefunden." }, { status: 404 });
  }

  if (action === "retry") {
    const updated = await prisma.syncQueue.update({
      where: { id: jobId },
      data: {
        status: "pending",
        attempts: job.attempts,
        nextAttemptAt: new Date(),
        errorMessage: null,
      },
    });
    return NextResponse.json({ ok: true, job: updated });
  }

  if (action === "cancel") {
    const updated = await prisma.syncQueue.update({
      where: { id: jobId },
      data: { status: "failed", errorMessage: "Von Admin storniert." },
    });
    return NextResponse.json({ ok: true, job: updated });
  }

  return NextResponse.json({ error: "Ungültige Aktion." }, { status: 400 });
}
