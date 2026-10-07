import { NextResponse } from "next/server";
import { requireUserOrDevice } from "@/lib/device/auth";
import { tvWeek } from "@/lib/tv/sections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tv/v1/week – Bereich für die TV-App (Session oder Geräte-Token), siehe docs/TV_API.md. */
export async function GET(request: Request) {
  const auth = await requireUserOrDevice(request);
  if (auth.response) return auth.response;
  return NextResponse.json(await tvWeek(auth.userId), { headers: { "Cache-Control": "no-store" } });
}
