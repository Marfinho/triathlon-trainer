import { createHash, randomBytes, randomInt } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";

/**
 * Geräte-Kopplung nach RFC 8628 (OAuth 2.0 Device Authorization Grant) für
 * Geräte ohne bequeme Texteingabe – konkret die Fire-TV-App "brick-tv".
 *
 * Ablauf:
 *   1. Gerät: POST /api/device/code   → device_code (geheim) + user_code (kurz)
 *   2. Nutzer: öffnet /device (eingeloggt), gibt user_code ein, gibt frei
 *   3. Gerät: pollt POST /api/device/token bis access_token oder Fehler
 *
 * - device_code: 256 Bit Zufall, nur der SHA-256-Hash liegt in der DB.
 * - user_code: 8 Zeichen aus einem Alphabet ohne Vokale/verwechselbare
 *   Zeichen (RFC 8628 §6.1), Anzeige als "XXXX-XXXX", 10 min gültig.
 * - Geräte-Token: Präfix `lht_`, 256 Bit, nur Hash gespeichert, kein Ablauf,
 *   widerrufbar (Gerät bekommt dann 401 und koppelt neu).
 */

export const DEVICE_TOKEN_PREFIX = "lht_";
export const DEVICE_CODE_TTL_SEC = 600;
export const POLL_INTERVAL_SEC = 5;
export const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";
const USER_CODE_LENGTH = 8;

type Db = Pick<PrismaClient, "deviceAuthorization" | "deviceToken" | "$transaction">;

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateUserCode(): string {
  let out = "";
  for (let i = 0; i < USER_CODE_LENGTH; i++) {
    out += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)];
  }
  return out;
}

/** "bcdf-ghjk " → "BCDFGHJK"; `null`, wenn das Format nicht passt. */
export function normalizeUserCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z]/g, "");
  if (code.length !== USER_CODE_LENGTH) return null;
  for (const c of code) if (!USER_CODE_ALPHABET.includes(c)) return null;
  return code;
}

export function formatUserCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Name des Geräts aus der Anfrage: kurz, ohne Steuerzeichen. */
export function sanitizeClientName(raw: unknown): string {
  const s = typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f]/g, "").trim() : "";
  return (s || "Brick TV").slice(0, 60);
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export async function createDeviceAuthorization(
  opts: { baseUrl: string; clientName: string; now?: Date },
  db: Db = defaultPrisma,
): Promise<DeviceCodeResponse> {
  const now = opts.now ?? new Date();
  const deviceCode = randomBytes(32).toString("base64url");
  // Kollisionen des user_code sind selten (20^8), aber möglich → neu würfeln.
  for (let attempt = 0; attempt < 5; attempt++) {
    const userCode = generateUserCode();
    try {
      await db.deviceAuthorization.create({
        data: {
          deviceCodeHash: sha256(deviceCode),
          userCode,
          clientName: opts.clientName,
          expiresAt: new Date(now.getTime() + DEVICE_CODE_TTL_SEC * 1000),
        },
      });
      const verificationUri = `${opts.baseUrl}/device`;
      return {
        device_code: deviceCode,
        user_code: formatUserCode(userCode),
        verification_uri: verificationUri,
        verification_uri_complete: `${verificationUri}?code=${formatUserCode(userCode)}`,
        expires_in: DEVICE_CODE_TTL_SEC,
        interval: POLL_INTERVAL_SEC,
      };
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
      // Abgelaufene Einträge mit demselben Code aufräumen und erneut versuchen.
      await db.deviceAuthorization.deleteMany({ where: { userCode, expiresAt: { lt: now } } });
    }
  }
  throw new Error("Konnte keinen eindeutigen Code erzeugen.");
}

export type LookupResult =
  | { ok: true; id: string; clientName: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/** Für die Freigabeseite: ist der Code (noch) einlösbar? */
export async function lookupUserCode(
  input: string,
  db: Db = defaultPrisma,
  now: Date = new Date(),
): Promise<LookupResult> {
  const code = normalizeUserCode(input);
  if (!code) return { ok: false, reason: "invalid" };
  const row = await db.deviceAuthorization.findUnique({ where: { userCode: code } });
  if (!row) return { ok: false, reason: "invalid" };
  if (row.expiresAt <= now) return { ok: false, reason: "expired" };
  if (row.status !== "pending") return { ok: false, reason: "used" };
  return { ok: true, id: row.id, clientName: row.clientName };
}

/** Nutzer gibt frei oder lehnt ab. Nur `pending` + nicht abgelaufen. */
export async function decideUserCode(
  opts: { userCode: string; userId: string; approve: boolean; now?: Date },
  db: Db = defaultPrisma,
): Promise<LookupResult> {
  const now = opts.now ?? new Date();
  const found = await lookupUserCode(opts.userCode, db, now);
  if (!found.ok) return found;
  const res = await db.deviceAuthorization.updateMany({
    where: { id: found.id, status: "pending", expiresAt: { gt: now } },
    data: { status: opts.approve ? "approved" : "denied", userId: opts.userId },
  });
  if (res.count === 0) return { ok: false, reason: "used" };
  return found;
}

export type TokenPollResult =
  | { ok: true; accessToken: string; tokenId: string; userId: string }
  | {
      ok: false;
      error:
        | "authorization_pending"
        | "slow_down"
        | "expired_token"
        | "access_denied"
        | "invalid_grant";
    };

/**
 * Token-Abfrage des Geräts (RFC 8628 §3.4/3.5). Pollt das Gerät schneller als
 * `interval`, kommt `slow_down`. Ein freigegebener Code wird genau einmal
 * eingelöst (atomar über den Statuswechsel approved → consumed).
 */
export async function pollDeviceToken(
  deviceCode: string,
  db: Db = defaultPrisma,
  now: Date = new Date(),
): Promise<TokenPollResult> {
  if (!deviceCode || deviceCode.length > 200) return { ok: false, error: "invalid_grant" };
  const row = await db.deviceAuthorization.findUnique({
    where: { deviceCodeHash: sha256(deviceCode) },
  });
  if (!row || row.status === "consumed") return { ok: false, error: "invalid_grant" };
  if (row.expiresAt <= now) return { ok: false, error: "expired_token" };
  if (row.status === "denied") return { ok: false, error: "access_denied" };

  if (row.status === "pending") {
    const tooFast =
      row.lastPolledAt != null &&
      now.getTime() - row.lastPolledAt.getTime() < (POLL_INTERVAL_SEC - 1) * 1000;
    await db.deviceAuthorization.update({ where: { id: row.id }, data: { lastPolledAt: now } });
    return { ok: false, error: tooFast ? "slow_down" : "authorization_pending" };
  }

  // approved → consumed (genau ein Gewinner bei parallelen Polls).
  const claimed = await db.deviceAuthorization.updateMany({
    where: { id: row.id, status: "approved" },
    data: { status: "consumed", lastPolledAt: now },
  });
  if (claimed.count === 0 || !row.userId) return { ok: false, error: "invalid_grant" };

  const token = DEVICE_TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const created = await db.deviceToken.create({
    data: {
      userId: row.userId,
      name: row.clientName,
      tokenHash: sha256(token),
      prefix: `${token.slice(0, DEVICE_TOKEN_PREFIX.length + 4)}…`,
    },
  });
  return { ok: true, accessToken: token, tokenId: created.id, userId: row.userId };
}

export interface DevicePrincipal {
  tokenId: string;
  userId: string;
  name: string;
}

/** Extrahiert ein Geräte-Token aus `Authorization: Bearer lht_…`. */
export function deviceBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!m) return null;
  const token = m[1];
  if (!token.startsWith(DEVICE_TOKEN_PREFIX) || token.length > 128) return null;
  return token;
}

export async function authenticateDeviceToken(
  token: string,
  db: Db = defaultPrisma,
): Promise<DevicePrincipal | null> {
  const row = await db.deviceToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.revokedAt) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.deviceToken
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }
  return { tokenId: row.id, userId: row.userId, name: row.name };
}

/** Widerruft ein Geräte-Token; mit `userId` nur eigene Geräte. */
export async function revokeDeviceToken(
  id: string,
  userId: string | null,
  db: Db = defaultPrisma,
): Promise<boolean> {
  const res = await db.deviceToken.updateMany({
    where: { id, revokedAt: null, ...(userId ? { userId } : {}) },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

export async function listDeviceTokens(userId: string, db: Db = defaultPrisma) {
  return db.deviceToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  });
}
