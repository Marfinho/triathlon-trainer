import { NextResponse } from "next/server";
import { pollDeviceCode, POLL_INTERVAL_SEC } from "@/lib/device/pairing";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/device/token – Gerät pollt, bis der Nutzer bestätigt hat (RFC 8628 §3.4).
 * Öffentlich. Body JSON oder form-encoded: { device_code, grant_type? }.
 * Fehler: authorization_pending | slow_down | access_denied | expired_token | invalid_grant.
 */
export async function POST(request: Request) {
  const limit = await checkRateLimit(`device-token-ip:${clientIp(request)}`, 120, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "slow_down", interval: POLL_INTERVAL_SEC * 2 },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let params: Record<string, unknown> = {};
  try {
    if ((request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
      params = Object.fromEntries(new URLSearchParams(await request.text()));
    } else {
      params = (await request.json()) as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: NO_STORE });
  }
  if (params.grant_type !== undefined && params.grant_type !== GRANT_TYPE) {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400, headers: NO_STORE });
  }

  const result = await pollDeviceCode(params.device_code);
  if (result.status === "ok") {
    return NextResponse.json(
      {
        access_token: result.token,
        token_type: "Bearer",
        scope: result.scopes.join(" "),
        device_name: result.deviceName,
      },
      { headers: NO_STORE },
    );
  }
  if (result.status === "slow_down") {
    return NextResponse.json(
      { error: "slow_down", interval: POLL_INTERVAL_SEC + 5 },
      { status: 400, headers: NO_STORE },
    );
  }
  return NextResponse.json({ error: result.status }, { status: 400, headers: NO_STORE });
}
