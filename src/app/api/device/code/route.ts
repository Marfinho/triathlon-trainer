import { NextResponse } from "next/server";
import { createDeviceCode, POLL_INTERVAL_SEC } from "@/lib/device/pairing";
import { baseUrl } from "@/lib/mcp/oauth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/device/code – Gerät (z. B. Fire-TV-App) startet die Kopplung
 * (RFC 8628 §3.1). Öffentlich; Body optional: { "device_name": "Wohnzimmer TV" }.
 */
export async function POST(request: Request) {
  const limit = await checkRateLimit(`device-code:${clientIp(request)}`, 20, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "slow_down" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let deviceName: unknown;
  try {
    const body = (await request.json()) as { device_name?: unknown };
    deviceName = body?.device_name;
  } catch {
    // Body ist optional.
  }

  const created = await createDeviceCode(deviceName);
  const base = baseUrl(request);
  return NextResponse.json(
    {
      device_code: created.deviceCode,
      user_code: created.userCode,
      verification_uri: `${base}/device`,
      verification_uri_complete: `${base}/device?code=${created.userCode}`,
      expires_in: created.expiresInSec,
      interval: POLL_INTERVAL_SEC,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
