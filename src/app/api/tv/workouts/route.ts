import { requireDevice, deviceJson } from "@/lib/device/http";
import { listTvWorkouts } from "@/lib/device/tvData";
import { addDays } from "@/domain/training/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tv/workouts?days=14 – geplante Rad- und Kraft-Einheiten ab gestern
 * bis `days` Tage in die Zukunft (1–28, Default 14).
 */
export async function GET(request: Request) {
  const { device, response } = await requireDevice(request);
  if (response) return response;
  const raw = Number(new URL(request.url).searchParams.get("days") ?? "14");
  const days = Number.isFinite(raw) ? Math.min(28, Math.max(1, Math.round(raw))) : 14;
  const now = new Date();
  const workouts = await listTvWorkouts(device.userId, { from: addDays(now, -1), to: addDays(now, days) });
  return deviceJson(200, { workouts });
}
