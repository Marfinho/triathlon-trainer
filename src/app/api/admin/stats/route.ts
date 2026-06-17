import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { collectAdminStats } from "@/lib/admin-stats";

/** GET /api/admin/stats – System-, User- und Domänen-Statistiken. */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const stats = await collectAdminStats(prisma);
  return NextResponse.json(stats);
}
