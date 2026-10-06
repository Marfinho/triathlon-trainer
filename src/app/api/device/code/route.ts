import { baseUrl } from "@/lib/mcp/oauth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { createDeviceAuthorization, sanitizeClientName } from "@/lib/device/flow";
import { deviceJson, readFormOrJson } from "@/lib/device/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/device/code – Schritt 1 des Device-Flows (RFC 8628 §3.1).
 * Öffentlich (das Gerät hat noch kein Token), daher pro IP gedrosselt.
 * Body (optional): { client_name }
 */
export async function POST(request: Request) {
  const rl = await checkRateLimit(`device-code:${clientIp(request)}`, 20, 15 * 60_000);
  if (!rl.allowed) {
    return deviceJson(429, { error: "slow_down" }, { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) });
  }
  const body = await readFormOrJson(request);
  if (!body) return deviceJson(400, { error: "invalid_request" });
  const res = await createDeviceAuthorization({
    baseUrl: baseUrl(request),
    clientName: sanitizeClientName(body.client_name),
  });
  return deviceJson(200, res);
}
