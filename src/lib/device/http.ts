import { NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { authenticateDeviceToken, deviceBearer, type DevicePrincipal } from "./flow";

export const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" } as const;

/** Fehlversuche je IP, bevor die Token-Prüfung für 15 min blockiert. */
export const DEVICE_AUTH_FAIL_LIMIT = 30;

export function deviceJson(status: number, body: unknown, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * Authentifiziert ein gekoppeltes Gerät über `Authorization: Bearer lht_…`.
 * 401 (ungültig/widerrufen) signalisiert der App: Token löschen, neu koppeln.
 */
export async function requireDevice(
  request: Request,
): Promise<{ device: DevicePrincipal; response?: undefined } | { device?: undefined; response: NextResponse }> {
  const unauthorized = () =>
    deviceJson(401, { error: "invalid_token" }, { "WWW-Authenticate": 'Bearer error="invalid_token"' });

  const token = deviceBearer(request.headers.get("authorization"));
  if (!token) return { response: unauthorized() };
  const device = await authenticateDeviceToken(token);
  if (device) return { device };

  // Nur Fehlschläge zählen (gültige Geräte pollen regelmäßig).
  const rl = await checkRateLimit(`device-auth:${clientIp(request)}`, DEVICE_AUTH_FAIL_LIMIT, 15 * 60_000);
  if (!rl.allowed) {
    return {
      response: deviceJson(429, { error: "rate_limited" }, { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) }),
    };
  }
  return { response: unauthorized() };
}

/** Liest einen JSON- oder form-urlencoded Body (RFC 8628 verlangt Form). */
export async function readFormOrJson(request: Request, maxBytes = 10_000): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.length > maxBytes) return null;
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
