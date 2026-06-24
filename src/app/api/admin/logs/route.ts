import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/logs – System- und Audit-Logs
 */

export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const url = new URL(request.url);
  const logType = url.searchParams.get("type") || "sync"; // "sync" | "audit"
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;

  if (logType === "audit") {
    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        select: {
          id: true,
          userId: true,
          action: true,
          ip: true,
          meta: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
    ]);

    return NextResponse.json({ logs, total, type: "audit", limit, offset });
  }

  // "sync" logs (default)
  const [total, logs] = await Promise.all([
    prisma.syncLog.count(),
    prisma.syncLog.findMany({
      select: {
        id: true,
        userId: true,
        localWorkoutId: true,
        action: true,
        type: true,
        status: true,
        durationMs: true,
        errorMessage: true,
        reason: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
  ]);

  return NextResponse.json({ logs, total, type: "sync", limit, offset });
}
