import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import {
  authenticateDeviceToken,
  deviceBearerFromHeader,
  type DeviceScope,
} from "./pairing";

export type DeviceOrUser =
  | { userId: string; via: "session" | "device"; tokenId?: string; deviceName?: string; response?: undefined }
  | { response: NextResponse };

const AUTH_FAIL_LIMIT = 20;
/** Sprachassistenten fragen höchstens sporadisch ab; ein enges Limit begrenzt Schaden bei Token-Leak. */
const TOKEN_LIMIT_PER_MINUTE: Record<DeviceScope, number> = { tv: 240, voice: 30, calendar: 60 };

/**
 * Auth für Routen, die zusätzlich zur Session auch ein Geräte-Token (`lht_…`)
 * akzeptieren (/api/tv/* und /api/live mit Scope "tv", /api/voice/* mit Scope "voice"). Bewusst NICHT in `requireUser()`
 * eingebaut: Ein Geräte-Token darf keine anderen Routen öffnen.
 *
 * Trägt die Anfrage einen Authorization-Header, zählt ausschließlich das Token
 * (kein Fallback auf eine Cookie-Session).
 */
export async function requireUserOrDevice(
  request: Request,
  scope: DeviceScope = "tv",
): Promise<DeviceOrUser> {
  if (!request.headers.get("authorization")) {
    const { user, response } = await requireUser();
    if (response) return { response };
    return { userId: user.userId, via: "session" };
  }

  const ip = clientIp(request);
  const token = deviceBearerFromHeader(request.headers.get("authorization"));
  const principal = token ? await authenticateDeviceToken(token) : null;
  if (!principal || !principal.scopes.includes(scope)) {
    const fails = await checkRateLimit(`device-authfail:${ip}`, AUTH_FAIL_LIMIT, 15 * 60_000);
    if (!fails.allowed) {
      return {
        response: NextResponse.json(
          { error: "too_many_requests" },
          { status: 429, headers: { "Retry-After": String(Math.ceil(fails.retryAfterMs / 1000)) } },
        ),
      };
    }
    return {
      response: NextResponse.json(
        { error: "invalid_token" },
        { status: 401, headers: { "WWW-Authenticate": `Bearer realm="localhub-${scope}"` } },
      ),
    };
  }

  const limit = await checkRateLimit(`device-token:${principal.tokenId}`, TOKEN_LIMIT_PER_MINUTE[scope], 60_000);
  if (!limit.allowed) {
    return {
      response: NextResponse.json(
        { error: "too_many_requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
      ),
    };
  }
  return { userId: principal.userId, via: "device", tokenId: principal.tokenId, deviceName: principal.name };
}
