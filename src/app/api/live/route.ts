import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { getLive, liveSnapshotSchema, publishLive } from "@/lib/live-session";

const MAX_BODY_BYTES = 32 * 1024;

/** GET /api/live – aktueller Live-Zustand der eigenen Einheit. */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  return NextResponse.json(getLive(user.userId));
}

/**
 * POST /api/live – das steuernde Gerät veröffentlicht den Live-Zustand
 * (Rolle/Kraft). `{ "kind": "idle" }` beendet die Anzeige.
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

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
  publishLive(user.userId, parsed.data);
  return NextResponse.json({ ok: true });
}
