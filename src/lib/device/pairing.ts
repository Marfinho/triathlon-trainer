import { randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { hashToken } from "@/lib/mcp/token";

/**
 * Geräte-Kopplung nach RFC 8628 (Device Authorization Grant) für TV-/Set-Top-
 * Clients wie die Fire-TV-App.
 *
 * Ablauf: Gerät holt `device_code` (geheim) + `user_code` (kurz) → zeigt Code/QR →
 * Nutzer bestätigt im eingeloggten Browser unter /device → Gerät pollt und erhält
 * einmalig einen Geräte-Token (`lht_…`, nur als Hash gespeichert).
 *
 * Sicherheit des kurzen Codes: 32^4 ≈ 1,05 Mio. Möglichkeiten, 10 min gültig,
 * nur im eingeloggten Browser prüfbar und dort je Nutzer rate-limitiert
 * (siehe /api/device/verify). Ein Treffer bindet ein fremdes Gerät höchstens an
 * das Konto des Rätenden – er verschafft keinen Zugriff auf fremde Daten.
 */

export const DEVICE_TOKEN_PREFIX = "lht_";
export const DEVICE_SCOPES = ["tv"] as const;
export type DeviceScope = (typeof DEVICE_SCOPES)[number];

export const USER_CODE_LENGTH = 4;
/** 32 Zeichen (Zweierpotenz → kein Modulo-Bias), ohne verwechselbare 0/O/1/I. */
export const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_TTL_SEC = 600;
export const POLL_INTERVAL_SEC = 5;
/** Etwas Toleranz für Netzjitter, bevor `slow_down` greift. */
const MIN_POLL_GAP_MS = (POLL_INTERVAL_SEC - 1) * 1000;
export const DEVICE_NAME_MAX = 40;

export function generateUserCode(): string {
  const bytes = randomBytes(USER_CODE_LENGTH);
  let code = "";
  for (const b of bytes) code += USER_CODE_ALPHABET[b & 31];
  return code;
}

/** Normalisiert Nutzereingaben ("ab-c d" → "ABCD"); `null` bei ungültigem Format. */
export function normalizeUserCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== USER_CODE_LENGTH) return null;
  for (const ch of code) if (!USER_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** Der Gerätename kommt ungeprüft aus einem öffentlichen Endpunkt und wird dem Nutzer angezeigt. */
export function sanitizeDeviceName(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  const cleaned = raw
    .replace(/[^\p{L}\p{N} ._()-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DEVICE_NAME_MAX);
  return cleaned || "Fire TV";
}

export function parseDeviceScopes(raw: unknown): DeviceScope[] {
  const list = Array.isArray(raw) ? raw : [];
  return DEVICE_SCOPES.filter((s) => list.includes(s));
}

// ---------------------------------------------------------------------------
// Gerät: Code anfordern und pollen
// ---------------------------------------------------------------------------

export interface CreatedDeviceCode {
  deviceCode: string;
  userCode: string;
  expiresInSec: number;
}

export async function createDeviceCode(
  deviceName: unknown,
  db: PrismaClient = defaultPrisma,
  now = new Date(),
): Promise<CreatedDeviceCode> {
  // Abgelaufene Codes aufräumen (Tabelle klein halten, user_code-Raum freigeben).
  await db.deviceCode
    .deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 3_600_000) } } })
    .catch(() => {});

  const name = sanitizeDeviceName(deviceName);
  const deviceCode = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + CODE_TTL_SEC * 1000);

  for (let attempt = 0; attempt < 8; attempt++) {
    const userCode = generateUserCode();
    try {
      // Ein noch gültiger Code gleichen Wortlauts blockiert; ein abgelaufener wird ersetzt.
      await db.deviceCode.deleteMany({ where: { userCode, expiresAt: { lte: now } } });
      await db.deviceCode.create({
        data: { deviceCodeHash: hashToken(deviceCode), userCode, deviceName: name, expiresAt },
      });
      return { deviceCode, userCode, expiresInSec: CODE_TTL_SEC };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Kein freier Kopplungscode verfügbar.");
}

export type PollResult =
  | { status: "ok"; token: string; scopes: DeviceScope[]; deviceName: string }
  | { status: "authorization_pending" }
  | { status: "slow_down" }
  | { status: "access_denied" }
  | { status: "expired_token" }
  | { status: "invalid_grant" };

export async function pollDeviceCode(
  deviceCode: unknown,
  db: PrismaClient = defaultPrisma,
  now = new Date(),
): Promise<PollResult> {
  if (typeof deviceCode !== "string" || deviceCode.length < 20 || deviceCode.length > 200) {
    return { status: "invalid_grant" };
  }
  const row = await db.deviceCode.findUnique({ where: { deviceCodeHash: hashToken(deviceCode) } });
  if (!row || row.status === "consumed") return { status: "invalid_grant" };
  if (row.expiresAt.getTime() <= now.getTime()) return { status: "expired_token" };
  if (row.status === "denied") return { status: "access_denied" };

  if (row.status === "pending") {
    const tooFast =
      row.lastPolledAt != null && now.getTime() - row.lastPolledAt.getTime() < MIN_POLL_GAP_MS;
    await db.deviceCode.update({ where: { id: row.id }, data: { lastPolledAt: now } });
    return { status: tooFast ? "slow_down" : "authorization_pending" };
  }

  // approved → genau einmal einlösen (atomar, schützt vor parallelem Polling).
  if (row.status !== "approved" || !row.userId) return { status: "invalid_grant" };
  const claimed = await db.deviceCode.updateMany({
    where: { id: row.id, status: "approved" },
    data: { status: "consumed" },
  });
  if (claimed.count !== 1) return { status: "invalid_grant" };

  const issued = await createDeviceToken({ userId: row.userId, name: row.deviceName }, db);
  return { status: "ok", token: issued.token, scopes: issued.scopes, deviceName: row.deviceName };
}

// ---------------------------------------------------------------------------
// Nutzer: Code prüfen und bestätigen/ablehnen (nur mit Session aufrufen)
// ---------------------------------------------------------------------------

export async function lookupUserCode(
  userCode: string,
  db: PrismaClient = defaultPrisma,
  now = new Date(),
): Promise<{ deviceName: string; createdAt: Date } | null> {
  const row = await db.deviceCode.findUnique({ where: { userCode } });
  if (!row || row.status !== "pending" || row.expiresAt.getTime() <= now.getTime()) return null;
  return { deviceName: row.deviceName, createdAt: row.createdAt };
}

export async function decideUserCode(
  opts: { userCode: string; userId: string; approve: boolean },
  db: PrismaClient = defaultPrisma,
  now = new Date(),
): Promise<boolean> {
  const res = await db.deviceCode.updateMany({
    where: { userCode: opts.userCode, status: "pending", expiresAt: { gt: now } },
    data: { status: opts.approve ? "approved" : "denied", userId: opts.userId },
  });
  return res.count === 1;
}

// ---------------------------------------------------------------------------
// Geräte-Token
// ---------------------------------------------------------------------------

export interface DevicePrincipal {
  tokenId: string;
  userId: string;
  name: string;
  scopes: DeviceScope[];
}

export async function createDeviceToken(
  opts: { userId: string; name: string; expiresInDays?: number | null },
  db: PrismaClient = defaultPrisma,
): Promise<{ id: string; token: string; prefix: string; scopes: DeviceScope[] }> {
  const token = DEVICE_TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const days = opts.expiresInDays === undefined ? null : opts.expiresInDays;
  const scopes: DeviceScope[] = ["tv"];
  const prefix = `${token.slice(0, DEVICE_TOKEN_PREFIX.length + 4)}…`;
  const row = await db.deviceToken.create({
    data: {
      userId: opts.userId,
      name: sanitizeDeviceName(opts.name),
      tokenHash: hashToken(token),
      prefix,
      scopes,
      expiresAt: days === null ? null : new Date(Date.now() + days * 86_400_000),
    },
  });
  return { id: row.id, token, prefix, scopes };
}

/** `Authorization: Bearer lht_…` → Token; sonst `null`. */
export function deviceBearerFromHeader(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!m || !m[1].startsWith(DEVICE_TOKEN_PREFIX) || m[1].length > 128) return null;
  return m[1];
}

export async function authenticateDeviceToken(
  token: string,
  db: PrismaClient = defaultPrisma,
): Promise<DevicePrincipal | null> {
  const row = await db.deviceToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.deviceToken
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }
  return { tokenId: row.id, userId: row.userId, name: row.name, scopes: parseDeviceScopes(row.scopes) };
}

/** Widerruft einen Token – nur wenn er dem Nutzer gehört. */
export async function revokeDeviceToken(
  id: string,
  userId: string,
  db: PrismaClient = defaultPrisma,
): Promise<boolean> {
  const res = await db.deviceToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

export async function listDeviceTokens(userId: string, db: PrismaClient = defaultPrisma) {
  return db.deviceToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  });
}
