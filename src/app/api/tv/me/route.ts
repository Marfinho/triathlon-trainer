import { requireDevice, deviceJson } from "@/lib/device/http";
import { tvProfile } from "@/lib/device/tvData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tv/me – Profil (Name, FTP, Schwellen-HF) und Gerätename. */
export async function GET(request: Request) {
  const { device, response } = await requireDevice(request);
  if (response) return response;
  const profile = await tvProfile(device.userId);
  return deviceJson(200, { ...profile, device: { id: device.tokenId, name: device.name } });
}
