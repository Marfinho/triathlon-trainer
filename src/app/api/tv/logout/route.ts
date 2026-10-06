import { recordAudit } from "@/lib/audit";
import { revokeDeviceToken } from "@/lib/device/flow";
import { requireDevice, deviceJson } from "@/lib/device/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/tv/logout – das Gerät meldet sich ab und widerruft sein Token. */
export async function POST(request: Request) {
  const { device, response } = await requireDevice(request);
  if (response) return response;
  await revokeDeviceToken(device.tokenId, device.userId);
  await recordAudit({ userId: device.userId, action: "device.logout", meta: { tokenId: device.tokenId } });
  return deviceJson(200, { ok: true });
}
