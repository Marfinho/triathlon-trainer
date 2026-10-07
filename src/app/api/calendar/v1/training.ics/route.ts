import { NextResponse } from "next/server";
import { requireUserOrDevice } from "@/lib/device/auth";
import { buildTrainingIcs } from "@/lib/calendar/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/v1/training.ics – Trainingsplan als Kalenderfeed (ICS).
 * Auth: Geräte-Token mit Scope "calendar" als `Authorization: Bearer lht_…` ODER
 * `?token=lht_…` (Kalender-Clients wie Google/Apple/Home Assistant senden keinen Header),
 * oder Session. Siehe docs/CALENDAR.md.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  let req = request;
  if (queryToken && !request.headers.get("authorization")) {
    const headers = new Headers(request.headers);
    headers.set("authorization", `Bearer ${queryToken}`);
    req = new Request(request, { headers });
  }
  const auth = await requireUserOrDevice(req, "calendar");
  if (auth.response) {
    auth.response.headers.set("Cache-Control", "no-store");
    return auth.response;
  }
  const ics = await buildTrainingIcs(auth.userId);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="brick-training.ics"',
      // Der Token steckt ggf. in der URL: nichts cachen, nichts weitergeben.
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
