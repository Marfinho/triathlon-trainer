import { NextResponse } from "next/server";
import { requireUserOrDevice } from "@/lib/device/auth";
import { tvToday } from "@/lib/tv/sections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tv/v1/today – Bereich für die TV-App (Session oder Geräte-Token), siehe docs/TV_API.md. */
export async function GET(request: Request) {
  const auth = await requireUserOrDevice(request);
  if (auth.response) return auth.response;
  return NextResponse.json(await tvToday(auth.userId), { headers: { "Cache-Control": "no-store" } });
}
