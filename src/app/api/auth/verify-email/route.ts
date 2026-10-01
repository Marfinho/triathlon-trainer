import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { consumeEmailToken } from "@/lib/email-tokens";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { sendWelcomeMail } from "@/lib/mail";

/** POST { token } – bestätigt die E-Mail-Adresse. */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = await checkRateLimit(`verify:${ip}`, 30, 15 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  const email = token ? await consumeEmailToken("verify", token) : null;
  if (!email) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
  const wasVerified = Boolean(user.emailVerified);
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  if (!wasVerified) await sendWelcomeMail(email);
  await recordAudit({ userId: user.id, action: "email_verified", ip });
  return NextResponse.json({ ok: true });
}
