import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { validatePasswordStrength } from "@/domain/auth/password";
import { sanitizeOptionalText } from "@/domain/security/sanitize";
import { recordAudit } from "@/lib/audit";
import { blockedResponse } from "@/lib/security/taunt";
import { isMailConfigured, sendVerificationMail } from "@/lib/mail";
import { createEmailToken } from "@/lib/email-tokens";

const BCRYPT_ROUNDS = 12;

/**
 * POST /api/auth/register – Registrierung per E-Mail/Passwort.
 * Body: { name?, email, password } – Passwort-Stärke wird server-seitig erzwungen.
 * Legt User + ein leeres AthleteProfile an und verschickt (falls SMTP
 * konfiguriert) die Bestätigungsmail.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = await checkRateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return blockedResponse(
      { error: "TOO_MANY_REQUESTS" },
      429,
      { headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = sanitizeOptionalText(body.name, 120);

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }
  const strength = validatePasswordStrength(password);
  if (!strength.ok) {
    return NextResponse.json(
      { error: "WEAK_PASSWORD", details: strength.errors },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  const verificationRequired = await isMailConfigured();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      provider: "credentials",
      // Ohne Mail-Konfiguration entfällt die Bestätigung (sofort aktiv).
      emailVerified: verificationRequired ? null : new Date(),
      athleteProfiles: {
        create: { name: name ?? email.split("@")[0] },
      },
    },
  });

  await recordAudit({ userId: user.id, action: "account_created", ip });

  if (verificationRequired) {
    const token = await createEmailToken("verify", email);
    await sendVerificationMail(email, token);
  }

  return NextResponse.json({ ok: true, userId: user.id, verificationRequired });
}
