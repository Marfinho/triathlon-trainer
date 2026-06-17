import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/profile/password – Passwort ändern. Nur für Credentials-Accounts.
 * Body: { currentPassword, newPassword } – newPassword min. 8 Zeichen.
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const rl = await checkRateLimit(`password-change:${userId}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "TOO_MANY_REQUESTS" }, { status: 429 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8) {
    return NextResponse.json({ ok: false, error: "WEAK_PASSWORD" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!dbUser?.passwordHash) {
    return NextResponse.json({ ok: false, error: "NO_PASSWORD_ACCOUNT" }, { status: 400 });
  }

  const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "WRONG_PASSWORD" }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
