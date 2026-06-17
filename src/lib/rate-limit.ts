/**
 * DB-gestützter Fixed-Window-Rate-Limiter (kein Redis nötig, läuft mit der
 * vorhandenen Postgres-Instanz). Gedacht für niedrigfrequente, sicherheits-
 * relevante Endpunkte (Login, Registrierung, Passwortänderung).
 *
 * Fixed-Window statt Sliding-Window: einfach, ausreichend für Brute-Force-
 * Abwehr, kein zusätzlicher Infra-Bedarf.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Prüft & inkrementiert den Zähler für `key` innerhalb eines `windowMs`-Fensters.
 * Öffnet ein neues Fenster, sobald das alte abgelaufen ist. Bei DB-Fehlern wird
 * großzügig erlaubt (Verfügbarkeit > Rate-Limit-Strenge).
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  db: PrismaClient = defaultPrisma,
): Promise<RateLimitResult> {
  const now = new Date();
  try {
    const existing = await db.rateLimitEntry.findUnique({ where: { key } });

    if (!existing || now.getTime() - existing.windowStart.getTime() >= windowMs) {
      await db.rateLimitEntry.upsert({
        where: { key },
        create: { key, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
      return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
    }

    if (existing.count >= limit) {
      const retryAfterMs =
        windowMs - (now.getTime() - existing.windowStart.getTime());
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
    }

    await db.rateLimitEntry.update({
      where: { key },
      data: { count: existing.count + 1 },
    });
    return { allowed: true, remaining: limit - existing.count - 1, retryAfterMs: 0 };
  } catch {
    return { allowed: true, remaining: limit, retryAfterMs: 0 };
  }
}

/** Extrahiert die Client-IP aus Standard-Proxy-Headern (Fallback "unknown"). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
