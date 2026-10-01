import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { consumeEmailToken } from "@/lib/email-tokens";
import { recordAudit } from "@/lib/audit";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

/** POST { token } – übernimmt die neue, per Mail bestätigte Adresse. */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = await checkRateLimit(`confirm-change:${ip}`, 30, 15 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  const payload = token ? await consumeEmailToken("change", token) : null;
  const sep = payload?.indexOf(":") ?? -1;
  if (!payload || sep < 1) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
  const userId = payload.slice(0, sep);
  const newEmail = payload.slice(sep + 1);

  try {
    await prisma.user.update({ where: { id: userId }, data: { email: newEmail, emailVerified: new Date() } });
  } catch {
    // z. B. Adresse inzwischen vergeben oder Konto gelöscht
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
  }
  await recordAudit({ userId, action: "email_changed", ip });
  return NextResponse.json({ ok: true });
}
