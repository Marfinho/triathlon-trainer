import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { decideUserCode } from "@/lib/device/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASON_TEXT = {
  invalid: "Unbekannter Code. Bitte den Code vom Fernseher prüfen.",
  expired: "Der Code ist abgelaufen. Starte die Kopplung am Fernseher neu.",
  used: "Dieser Code wurde bereits verwendet.",
} as const;

/**
 * POST /api/device/approve – eingeloggter Nutzer gibt ein Gerät frei.
 * Body: { userCode, decision: "allow" | "deny" }
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  // Gegen Durchprobieren von Codes (20^8 Kombinationen, 10 min gültig).
  const rl = await checkRateLimit(`device-approve:${user.userId}`, 20, 15 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Zu viele Versuche. Bitte später erneut." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { userCode?: unknown; decision?: unknown } | null;
  if (!body || typeof body.userCode !== "string") {
    return NextResponse.json({ ok: false, error: "Code fehlt." }, { status: 400 });
  }
  const res = await decideUserCode({
    userCode: body.userCode,
    userId: user.userId,
    approve: body.decision === "allow",
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: REASON_TEXT[res.reason] }, { status: 400 });
  return NextResponse.json({ ok: true, clientName: res.clientName, approved: body.decision === "allow" });
}
