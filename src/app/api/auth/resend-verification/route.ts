import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createEmailToken } from "@/lib/email-tokens";
import { isMailConfigured, sendVerificationMail } from "@/lib/mail";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

/** POST { email } – sendet die Bestätigungsmail erneut. Antwortet immer gleich (kein Konto-Orakel). */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const [a, b] = await Promise.all([
    checkRateLimit(`resend-ip:${ip}`, 10, 60 * 60 * 1000),
    checkRateLimit(`resend-email:${email}`, 3, 60 * 60 * 1000),
  ]);
  if (!a.allowed || !b.allowed) return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });

  if (email && (await isMailConfigured())) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified && user.passwordHash) {
      await sendVerificationMail(email, await createEmailToken("verify", email));
    }
  }
  return NextResponse.json({ ok: true });
}
