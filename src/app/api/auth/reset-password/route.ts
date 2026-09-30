import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { consumeEmailToken } from "@/lib/email-tokens";
import { validatePasswordStrength } from "@/domain/auth/password";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

/** POST { token, password } – setzt das Passwort neu (Token ist einmalig). */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = await checkRateLimit(`reset:${ip}`, 20, 15 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const strength = validatePasswordStrength(password);
  if (!strength.ok) {
    return NextResponse.json({ error: "WEAK_PASSWORD", details: strength.errors }, { status: 400 });
  }
  const email = token ? await consumeEmailToken("reset", token) : null;
  if (!email) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
  await prisma.user.update({
    where: { id: user.id },
    // Der Reset-Link kam per Mail an die Adresse → sie ist damit auch bestätigt.
    data: { passwordHash: await bcrypt.hash(password, 12), emailVerified: user.emailVerified ?? new Date() },
  });
  await recordAudit({ userId: user.id, action: "password_reset", ip });
  return NextResponse.json({ ok: true });
}
