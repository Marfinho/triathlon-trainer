import { NextResponse } from "next/server";
import { requireUserOrDevice } from "@/lib/device/auth";
import { createCheckin } from "@/lib/checkin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/tv/v1/checkin – Tages-Check-in vom Fernseher (Body wie POST /api/checkin). */
export async function POST(request: Request) {
  const auth = await requireUserOrDevice(request);
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }
  const result = await createCheckin(auth.userId, body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
