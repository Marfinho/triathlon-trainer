import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { createEmailToken } from "@/lib/email-tokens";
import { isMailConfigured, sendEmailChangeMail } from "@/lib/mail";
import { checkRateLimit } from "@/lib/rate-limit";

/** POST /api/profile/email – { newEmail, password } sendet einen Bestätigungslink an die neue Adresse. */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const rl = await checkRateLimit(`email-change:${user.userId}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
  if (!(await isMailConfigured())) return NextResponse.json({ error: "MAIL_NOT_CONFIGURED" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const newEmail = typeof body?.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser?.passwordHash) return NextResponse.json({ error: "NO_PASSWORD_ACCOUNT" }, { status: 400 });
  if (!(await bcrypt.compare(password, dbUser.passwordHash))) {
    return NextResponse.json({ error: "WRONG_PASSWORD" }, { status: 403 });
  }
  if (newEmail === dbUser.email) return NextResponse.json({ error: "SAME_EMAIL" }, { status: 400 });

  // Kein Orakel: bei vergebener Adresse antworten wir gleich, verschicken aber nichts.
  const taken = await prisma.user.findUnique({ where: { email: newEmail } });
  if (!taken) {
    const token = await createEmailToken("change", `${user.userId}:${newEmail}`);
    await sendEmailChangeMail(newEmail, token);
  }
  return NextResponse.json({ ok: true });
}
