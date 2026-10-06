import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { decideUserCode, lookupUserCode, normalizeUserCode } from "@/lib/device/pairing";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/device/verify – eingeloggter Nutzer prüft/bestätigt/lehnt einen
 * Kopplungscode ab. Body: { user_code, action: "lookup" | "approve" | "deny" }.
 * Jeder Aufruf zählt gegen ein Limit je Nutzer (Brute-Force-Schutz des kurzen Codes).
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const limit = await checkRateLimit(`device-verify:${user.userId}`, 20, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Zu viele Versuche. Bitte später erneut versuchen." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let body: { user_code?: unknown; action?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }
  const userCode = normalizeUserCode(body.user_code);
  const notFound = NextResponse.json(
    { ok: false, error: "Code unbekannt oder abgelaufen." },
    { status: 404 },
  );
  if (!userCode) return notFound;

  if (body.action === "lookup") {
    const found = await lookupUserCode(userCode);
    if (!found) return notFound;
    return NextResponse.json({
      ok: true,
      deviceName: found.deviceName,
      requestedAgoSec: Math.max(0, Math.round((Date.now() - found.createdAt.getTime()) / 1000)),
    });
  }
  if (body.action === "approve" || body.action === "deny") {
    const done = await decideUserCode({
      userCode,
      userId: user.userId,
      approve: body.action === "approve",
    });
    return done ? NextResponse.json({ ok: true }) : notFound;
  }
  return NextResponse.json({ ok: false, error: "Ungültige Aktion." }, { status: 400 });
}
