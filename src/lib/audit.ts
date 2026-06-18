import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";

/**
 * Schreibt einen Audit-Log-Eintrag für sicherheitsrelevante Aktionen.
 *
 * Bewusst „best effort": Fehler beim Protokollieren dürfen die eigentliche
 * Aktion (Login, Registrierung, …) niemals scheitern lassen – daher wird jeder
 * Fehler verschluckt.
 */
export async function recordAudit(
  entry: {
    userId?: string | null;
    action: string;
    ip?: string | null;
    meta?: Record<string, unknown>;
  },
  db: PrismaClient = defaultPrisma,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        ip: entry.ip ?? null,
        meta: entry.meta ? (entry.meta as object) : undefined,
      },
    });
  } catch {
    // Protokollierung darf den Hauptpfad nicht blockieren.
  }
}
