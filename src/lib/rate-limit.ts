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
  const windowStartCutoff = new Date(now.getTime() - windowMs);
  try {
    // Atomar statt Lesen-dann-Schreiben: parallele Requests (z. B. ein
    // Brute-Force-Burst) können sich sonst gegenseitig überholen und das
    // Limit überschreiten.
    const bumped = await db.rateLimitEntry.updateMany({
      where: { key, windowStart: { gt: windowStartCutoff } },
      data: { count: { increment: 1 } },
    });

    if (bumped.count === 0) {
      // Kein Eintrag oder Fenster abgelaufen -> neues Fenster öffnen.
      await db.rateLimitEntry.upsert({
        where: { key },
        create: { key, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
      return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
    }

    const entry = await db.rateLimitEntry.findUnique({ where: { key } });
    if (!entry) return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };

    if (entry.count > limit) {
      const retryAfterMs = windowMs - (now.getTime() - entry.windowStart.getTime());
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
    }
    return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 };
  } catch {
    return { allowed: true, remaining: limit, retryAfterMs: 0 };
  }
}

/**
 * Extrahiert die Client-IP aus Standard-Proxy-Headern (Fallback "unknown").
 *
 * X-Forwarded-For wird von jedem Proxy HINTEN ergänzt; der erste Eintrag kommt
 * ungeprüft vom Client und ist beliebig fälschbar (Rate-Limit-Umgehung). Daher
 * zählt der Eintrag, den der eigene Reverse-Proxy angehängt hat:
 * TRUSTED_PROXY_HOPS (Default 1) Einträge von hinten.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
    const ip = parts[Math.max(0, parts.length - hops)];
    if (ip) return ip;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
