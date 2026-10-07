import { NextResponse } from "next/server";
import { requireUserOrDevice } from "@/lib/device/auth";
import { loadVoiceSummary } from "@/lib/voice/data";
import type { VoiceDay, VoiceDetail } from "@/lib/voice/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAYS: readonly VoiceDay[] = ["today", "tomorrow", "week"];
const DETAILS: readonly VoiceDetail[] = ["short", "normal"];

/**
 * GET /api/voice/v1/summary?day=today|tomorrow|week&detail=short|normal
 * Sprechtext für Sprachassistenten (Home Assistant). Auth: Geräte-Token mit
 * Scope "voice" (`Authorization: Bearer lht_…`) oder Session. Siehe docs/VOICE.md.
 */
export async function GET(request: Request) {
  const auth = await requireUserOrDevice(request, "voice");
  if (auth.response) {
    auth.response.headers.set("Cache-Control", "no-store");
    return auth.response;
  }
  const params = new URL(request.url).searchParams;
  const day = (params.get("day") ?? "today") as VoiceDay;
  const detail = (params.get("detail") ?? "short") as VoiceDetail;
  if (!DAYS.includes(day) || !DETAILS.includes(detail)) {
    return NextResponse.json(
      { error: "invalid_params", message: "day: today|tomorrow|week, detail: short|normal" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const summary = await loadVoiceSummary(auth.userId, day, detail);
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
