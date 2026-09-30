import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createEmailToken } from "@/lib/email-tokens";
import { isMailConfigured, sendPasswordResetMail } from "@/lib/mail";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

/** POST { email } – verschickt einen Reset-Link. Antwortet immer gleich (kein Konto-Orakel). */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const [a, b] = await Promise.all([
    checkRateLimit(`forgot-ip:${ip}`, 10, 60 * 60 * 1000),
    checkRateLimit(`forgot-email:${email}`, 3, 60 * 60 * 1000),
  ]);
  if (!a.allowed || !b.allowed) return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });

  if (email && isMailConfigured()) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.passwordHash) {
      await sendPasswordResetMail(email, await createEmailToken("reset", email));
      await recordAudit({ userId: user.id, action: "password_reset_requested", ip });
    }
  }
  return NextResponse.json({ ok: true, mailConfigured: isMailConfigured() });
}
