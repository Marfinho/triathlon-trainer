import { recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { DEVICE_GRANT_TYPE, pollDeviceToken } from "@/lib/device/flow";
import { deviceJson, readFormOrJson } from "@/lib/device/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/device/token – das Gerät pollt (RFC 8628 §3.4).
 * Body: grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=…
 * Fehler als 400 { error: authorization_pending | slow_down | expired_token |
 * access_denied | invalid_grant }.
 */
export async function POST(request: Request) {
  const body = await readFormOrJson(request);
  if (!body) return deviceJson(400, { error: "invalid_request" });
  if (body.grant_type !== DEVICE_GRANT_TYPE) return deviceJson(400, { error: "unsupported_grant_type" });
  const deviceCode = typeof body.device_code === "string" ? body.device_code : "";
  const res = await pollDeviceToken(deviceCode);
  if (!res.ok) return deviceJson(400, { error: res.error });
  await recordAudit({
    userId: res.userId,
    action: "device.paired",
    ip: clientIp(request),
    meta: { tokenId: res.tokenId },
  });
  return deviceJson(200, { access_token: res.accessToken, token_type: "Bearer", scope: "tv" });
}
