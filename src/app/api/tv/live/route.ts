import { liveSnapshotSchema, publishLive } from "@/lib/live-session";
import { requireDevice, deviceJson } from "@/lib/device/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;

/**
 * POST /api/tv/live – die TV-App veröffentlicht den Live-Zustand (gleiches
 * Format wie POST /api/live), damit /trainer/tv auf weiteren Bildschirmen
 * mitläuft. `{ "kind": "idle" }` beendet die Anzeige.
 */
export async function POST(request: Request) {
  const { device, response } = await requireDevice(request);
  if (response) return response;
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return deviceJson(413, { ok: false, error: "Body zu groß." });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return deviceJson(400, { ok: false, error: "Ungültiger Body." });
  }
  const parsed = liveSnapshotSchema.safeParse(json);
  if (!parsed.success) return deviceJson(400, { ok: false, error: "Ungültiger Live-Zustand." });
  publishLive(device.userId, parsed.data);
  return deviceJson(200, { ok: true });
}
