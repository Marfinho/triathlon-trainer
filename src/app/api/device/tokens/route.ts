import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { listDeviceTokens, revokeDeviceToken } from "@/lib/device/pairing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/device/tokens – gekoppelte Geräte des Nutzers (ohne Token-Werte). */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  return NextResponse.json({ ok: true, devices: await listDeviceTokens(user.userId) });
}

/** DELETE /api/device/tokens – Gerät entkoppeln. Body: { id }. */
export async function DELETE(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  let id: unknown;
  try {
    id = ((await request.json()) as { id?: unknown }).id;
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ ok: false, error: "id fehlt." }, { status: 400 });
  }
  const done = await revokeDeviceToken(id, user.userId);
  return done
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, error: "Gerät nicht gefunden." }, { status: 404 });
}
