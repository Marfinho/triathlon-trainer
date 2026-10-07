import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { createDeviceToken, listDeviceTokens, revokeDeviceToken, sanitizeDeviceName } from "@/lib/device/pairing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/device/tokens – gekoppelte Geräte des Nutzers (ohne Token-Werte). */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  return NextResponse.json({ ok: true, devices: await listDeviceTokens(user.userId) });
}

/**
 * POST /api/device/tokens – Sprachassistent-Token erzeugen. Body: { name, scope: "voice" }.
 * Nur mit Session (kein Geräte-Token). Der Klartext wird genau einmal zurückgegeben.
 * Andere Scopes (z. B. "tv") laufen ausschließlich über den Device-Code-Flow.
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  if (request.headers.get("authorization")) {
    return NextResponse.json({ ok: false, error: "Nur mit Session." }, { status: 403 });
  }
  const limit = await checkRateLimit(`device-create:${user.userId}`, 10, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Zu viele Anfragen." }, { status: 429 });
  }
  let body: { name?: unknown; scope?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }
  if (body.scope !== "voice") {
    return NextResponse.json({ ok: false, error: 'Nur scope "voice" erlaubt.' }, { status: 400 });
  }
  const name = typeof body.name === "string" && body.name.trim() ? body.name : "Sprachassistent";
  const issued = await createDeviceToken({ userId: user.userId, name, scopes: ["voice"] });
  return NextResponse.json(
    { ok: true, id: issued.id, name: sanitizeDeviceName(name), token: issued.token, prefix: issued.prefix, scopes: issued.scopes },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
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
