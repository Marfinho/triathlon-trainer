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
    // Ein einziges atomares Statement: Eintrag anlegen ODER hochzählen bzw.
    // ein abgelaufenes Fenster neu starten. Postgres sperrt die Zeile beim
    // ON CONFLICT, dadurch können sich parallele Requests (z. B. ein
    // Brute-Force-Burst) nicht gegenseitig überholen.
    const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
      INSERT INTO "RateLimitEntry" ("key", "count", "windowStart", "updatedAt")
      VALUES (${key}, 1, ${now}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitEntry"."windowStart" <= ${windowStartCutoff}
                       THEN 1 ELSE "RateLimitEntry"."count" + 1 END,
        "windowStart" = CASE WHEN "RateLimitEntry"."windowStart" <= ${windowStartCutoff}
                             THEN ${now} ELSE "RateLimitEntry"."windowStart" END,
        "updatedAt" = ${now}
      RETURNING "count", "windowStart"`;
    const entry = rows[0];
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
