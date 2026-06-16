import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * POST /api/auth/register – Registrierung per E-Mail/Passwort.
 * Body: { name?, email, password } – Passwort min. 8 Zeichen (server-seitig erzwungen).
 * Legt User + ein leeres AthleteProfile an.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : null;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      provider: "credentials",
      athleteProfiles: {
        create: { name: name ?? email.split("@")[0] },
      },
    },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
