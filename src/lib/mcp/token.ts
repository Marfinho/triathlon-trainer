import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";

/**
 * Persönliche Zugriffstoken für den Remote-MCP-Server.
 *
 * - 256 Bit Zufall, Präfix `lhm_` (Secret-Scanner-freundlich).
 * - Gespeichert wird nur der SHA-256-Hash (das Token ist hochentropisch, ein
 *   langsamer KDF ist daher nicht nötig). Das Klartext-Token existiert nur
 *   einmal: beim Erzeugen.
 * - Scopes: "read" (immer) und optional "write_plan".
 */

export const TOKEN_PREFIX = "lhm_";
export const MCP_SCOPES = ["read", "write_plan"] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export interface McpPrincipal {
  tokenId: string;
  userId: string;
  scopes: McpScope[];
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeScopes(raw: unknown): McpScope[] {
  const list = Array.isArray(raw) ? raw : [];
  const scopes = new Set<McpScope>(["read"]);
  for (const s of list) {
    if ((MCP_SCOPES as readonly unknown[]).includes(s)) scopes.add(s as McpScope);
  }
  return [...scopes];
}

export async function createMcpToken(
  opts: {
    userId: string;
    name: string;
    writePlan?: boolean;
    /** Gültigkeit in Tagen; `null` = unbegrenzt. Default: 365. */
    expiresInDays?: number | null;
  },
  db: PrismaClient = defaultPrisma,
): Promise<{ id: string; token: string; prefix: string; scopes: McpScope[]; expiresAt: Date | null }> {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const scopes: McpScope[] = opts.writePlan ? ["read", "write_plan"] : ["read"];
  const days = opts.expiresInDays === undefined ? 365 : opts.expiresInDays;
  const expiresAt = days === null ? null : new Date(Date.now() + days * 86_400_000);
  const prefix = `${token.slice(0, TOKEN_PREFIX.length + 4)}…`;
  const row = await db.mcpToken.create({
    data: {
      userId: opts.userId,
      name: opts.name.slice(0, 80),
      tokenHash: hashToken(token),
      prefix,
      scopes,
      expiresAt,
    },
  });
  return { id: row.id, token, prefix, scopes, expiresAt };
}

/** Extrahiert das Token aus `Authorization: Bearer <token>`; sonst `null`. */
export function bearerFromHeader(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!m) return null;
  const token = m[1];
  // Offensichtlich falsche Formate früh verwerfen (kein DB-Zugriff nötig).
  if (!token.startsWith(TOKEN_PREFIX) || token.length > 128) return null;
  return token;
}

/**
 * Prüft ein Token: bekannt, nicht widerrufen, nicht abgelaufen. Aktualisiert
 * `lastUsedAt` (höchstens einmal pro Minute, um Schreiblast zu sparen).
 */
export async function authenticateToken(
  token: string,
  db: PrismaClient = defaultPrisma,
): Promise<McpPrincipal | null> {
  const row = await db.mcpToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;

  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.mcpToken
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }
  return { tokenId: row.id, userId: row.userId, scopes: normalizeScopes(row.scopes) };
}

export async function revokeMcpToken(
  id: string,
  db: PrismaClient = defaultPrisma,
): Promise<boolean> {
  const res = await db.mcpToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

export async function listMcpTokens(userId: string | undefined, db: PrismaClient = defaultPrisma) {
  return db.mcpToken.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      name: true,
      prefix: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}
