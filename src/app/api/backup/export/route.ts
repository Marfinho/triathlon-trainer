import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { getEffectiveLimits } from "@/lib/plan-config";
import { buildBackupForUser } from "@/lib/backup";

/**
 * GET /api/backup/export – vollständiges Backup (Version 2) als Download.
 * Free-User: Cooldown (manualBackupCooldownHours) gegen den letzten Backup-Log.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const cooldownHours = (await getEffectiveLimits(user.plan)).manualBackupCooldownHours;
  if (cooldownHours > 0) {
    const last = await prisma.syncLog.findFirst({
      where: { userId, type: "backup" },
      orderBy: { createdAt: "desc" },
    });
    if (last) {
      const nextAt = new Date(
        last.createdAt.getTime() + cooldownHours * 3600 * 1000,
      );
      if (nextAt.getTime() > Date.now()) {
        return NextResponse.json(
          { error: "BACKUP_COOLDOWN", nextBackupAt: nextAt.toISOString() },
          { status: 429 },
        );
      }
    }
  }

  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  const backup = await buildBackupForUser(prisma, userId, dbUser?.email ?? "");

  await prisma.syncLog.create({
    data: { userId, type: "backup", status: "success", success: true },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="localhub-backup-${stamp}.json"`,
    },
  });
}
