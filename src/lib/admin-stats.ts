/**
 * Server-only: sammelt System-, User- und Domänen-Statistiken für das
 * Admin-Dashboard. Rein lesend.
 */
import os from "node:os";
import type { PrismaClient } from "@prisma/client";

export interface SystemStats {
  hostname: string;
  platform: string;
  nodeVersion: string;
  cpuCount: number;
  loadAvg: [number, number, number];
  loadPerCorePct: number; // 1-Minuten-Load relativ zu den Kernen, in %
  totalMemBytes: number;
  freeMemBytes: number;
  usedMemPct: number;
  processRssBytes: number;
  processHeapUsedBytes: number;
  processUptimeSec: number;
  systemUptimeSec: number;
  dbSizeBytes: number | null;
}

export interface UserStats {
  total: number;
  byPlan: Record<string, number>;
  byRole: Record<string, number>;
  admins: number;
  withActiveSubscription: number;
  newLast7Days: number;
  newLast30Days: number;
  activeIntegrations: number;
}

export interface DomainStats {
  plannedWorkouts: number;
  actualActivities: number;
  raceEvents: number;
  planImports: number;
  gearItems: number;
  syncQueuePending: number;
  syncQueueFailed: number;
  syncLogsLast24h: number;
}

export interface AdminStats {
  generatedAt: string;
  system: SystemStats;
  users: UserStats;
  domain: DomainStats;
}

function bytesOfDbSize(rows: unknown): number | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  const v = row.size ?? row.pg_database_size;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function collectAdminStats(
  db: PrismaClient,
): Promise<AdminStats> {
  const now = new Date();
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    byPlanRaw,
    byRoleRaw,
    withSubscription,
    new7,
    new30,
    activeIntegrations,
    plannedWorkouts,
    actualActivities,
    raceEvents,
    planImports,
    gearItems,
    syncQueuePending,
    syncQueueFailed,
    syncLogsLast24h,
    dbSizeRows,
  ] = await Promise.all([
    db.user.count(),
    db.user.groupBy({ by: ["plan"], _count: { _all: true } }),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.user.count({ where: { stripeSubscriptionId: { not: null } } }),
    db.user.count({ where: { createdAt: { gte: since7 } } }),
    db.user.count({ where: { createdAt: { gte: since30 } } }),
    db.userIntegration.count({ where: { enabled: true } }),
    db.plannedWorkout.count(),
    db.actualActivity.count(),
    db.raceEvent.count(),
    db.trainingPlanImport.count(),
    db.gearItem.count(),
    db.syncQueue.count({ where: { status: "pending" } }),
    db.syncQueue.count({ where: { status: "failed" } }),
    db.syncLog.count({ where: { createdAt: { gte: since24h } } }),
    db
      .$queryRaw`SELECT pg_database_size(current_database()) AS size`
      .catch(() => null),
  ]);

  const byPlan: Record<string, number> = {};
  for (const r of byPlanRaw) byPlan[r.plan] = r._count._all;
  const byRole: Record<string, number> = {};
  for (const r of byRoleRaw) byRole[r.role] = r._count._all;

  const cpuCount = os.cpus().length || 1;
  const load = os.loadavg();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const mem = process.memoryUsage();

  const system: SystemStats = {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    nodeVersion: process.version,
    cpuCount,
    loadAvg: [load[0], load[1], load[2]],
    loadPerCorePct: Math.round((load[0] / cpuCount) * 100),
    totalMemBytes: totalMem,
    freeMemBytes: freeMem,
    usedMemPct: Math.round(((totalMem - freeMem) / totalMem) * 100),
    processRssBytes: mem.rss,
    processHeapUsedBytes: mem.heapUsed,
    processUptimeSec: Math.round(process.uptime()),
    systemUptimeSec: Math.round(os.uptime()),
    dbSizeBytes: bytesOfDbSize(dbSizeRows),
  };

  const users: UserStats = {
    total: totalUsers,
    byPlan,
    byRole,
    admins: byRole.admin ?? 0,
    withActiveSubscription: withSubscription,
    newLast7Days: new7,
    newLast30Days: new30,
    activeIntegrations,
  };

  const domain: DomainStats = {
    plannedWorkouts,
    actualActivities,
    raceEvents,
    planImports,
    gearItems,
    syncQueuePending,
    syncQueueFailed,
    syncLogsLast24h,
  };

  return {
    generatedAt: now.toISOString(),
    system,
    users,
    domain,
  };
}
