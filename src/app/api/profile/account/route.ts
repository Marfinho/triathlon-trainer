import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import bcrypt from "bcryptjs";
import { sanitizeText } from "@/domain/security/sanitize";
import { stripe } from "@/lib/stripe";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

/** PATCH /api/profile/account – Account-Anzeigename ändern. Body: { name } */
export async function PATCH(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const name = sanitizeText(body.name, 120);
  if (!name) {
    return NextResponse.json({ ok: false, error: "Name ist erforderlich." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name },
  });

  return NextResponse.json({ ok: true, name: updated.name });
}

/**
 * DELETE /api/profile/account – Konto und ALLE Daten unwiderruflich löschen
 * (DSGVO Art. 17). Body: { confirm: "LÖSCHEN", password? } – Konten mit Passwort
 * müssen es zusätzlich angeben. Alle Domänendaten hängen per onDelete: Cascade
 * am User; Audit-Log-Einträge (ohne FK) werden explizit mitgelöscht.
 */
export async function DELETE(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== "LÖSCHEN") {
    return NextResponse.json({ ok: false, error: "CONFIRM_REQUIRED" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!dbUser) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (dbUser.passwordHash) {
    const password = typeof body.password === "string" ? body.password : "";
    const rl = await checkRateLimit(`delete-account:${userId}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) return NextResponse.json({ ok: false, error: "TOO_MANY_REQUESTS" }, { status: 429 });
    if (!password || !(await bcrypt.compare(password, dbUser.passwordHash))) {
      return NextResponse.json({ ok: false, error: "WRONG_PASSWORD" }, { status: 403 });
    }
  }

  // Laufendes Stripe-Abo beenden, damit nach der Löschung nicht weiter abgebucht wird.
  if (stripe && dbUser.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(dbUser.stripeSubscriptionId);
    } catch (err) {
      console.error("[account-delete] Stripe-Kündigung fehlgeschlagen:", err instanceof Error ? err.message : err);
      return NextResponse.json({ ok: false, error: "BILLING_CANCEL_FAILED" }, { status: 502 });
    }
  }

  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { userId } }),
    prisma.verificationToken.deleteMany({
      where: { OR: [{ identifier: { endsWith: `:${dbUser.email}` } }, { identifier: { startsWith: `change:${userId}:` } }] },
    }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
  await recordAudit({ action: "account_deleted", ip: clientIp(request) });

  return NextResponse.json({ ok: true });
}
