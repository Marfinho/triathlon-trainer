import { requireUserOrDevice } from "@/lib/device/auth";
import { createActivityFromRequest } from "@/lib/activities/create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tv/v1/activities – die TV-App lädt eine aufgezeichnete Einheit hoch.
 * Body wie POST /api/activities; `source` ist standardmäßig "tv". Mit `externalId`
 * (UUID) idempotent – sicheres Wiederholen nach Netzausfall.
 */
export async function POST(request: Request) {
  const auth = await requireUserOrDevice(request);
  if (auth.response) return auth.response;
  return createActivityFromRequest(auth.userId, request, "tv");
}
