import { NextResponse } from "next/server";
import { requireUserOrDevice } from "@/lib/device/auth";
import { getLive, liveSnapshotSchema, publishLive } from "@/lib/live-session";

const MAX_BODY_BYTES = 32 * 1024;

/** GET /api/live – aktueller Live-Zustand der eigenen Einheit. */
export async function GET(request: Request) {
  const auth = await requireUserOrDevice(request);
  if (auth.response) return auth.response;
  return NextResponse.json(getLive(auth.userId));
}

/**
 * POST /api/live – das steuernde Gerät veröffentlicht den Live-Zustand
 * (Rolle/Kraft). `{ "kind": "idle" }` beendet die Anzeige.
 */
export async function POST(request: Request) {
  const auth = await requireUserOrDevice(request);
  if (auth.response) return auth.response;

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Body zu groß." }, { status: 413 });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }
  const parsed = liveSnapshotSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Ungültiger Live-Zustand." }, { status: 400 });
  }
  publishLive(auth.userId, parsed.data);
  return NextResponse.json({ ok: true });
}
