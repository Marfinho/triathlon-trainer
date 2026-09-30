import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getMailConfigView, setMailConfig, sendMailDetailed } from "@/lib/mail";
import { recordAudit } from "@/lib/audit";

/**
 * GET  /api/admin/mail – aktuelle SMTP-Konfiguration (Passwort maskiert).
 * POST /api/admin/mail – { host?, port?, secure?, user?, password?, clearPassword?, from? }
 *      speichert; { test: true, to } verschickt stattdessen eine Testmail.
 */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  return NextResponse.json({ mail: await getMailConfigView() });
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  if (body.test === true) {
    const to = typeof body.to === "string" ? body.to.trim() : "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return NextResponse.json({ error: "Ungültige Empfänger-Adresse." }, { status: 400 });
    }
    const error = await sendMailDetailed({
      to,
      subject: "Testmail von Brick",
      text: "Die SMTP-Konfiguration funktioniert.",
      html: "<p>Die SMTP-Konfiguration funktioniert.</p>",
    });
    return error
      ? NextResponse.json({ error }, { status: 502 })
      : NextResponse.json({ ok: true });
  }

  const port = body.port === undefined || body.port === "" ? undefined : Number(body.port);
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    return NextResponse.json({ error: "Ungültiger Port." }, { status: 400 });
  }
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

  const mail = await setMailConfig(
    {
      host: str(body.host, 253),
      port,
      secure: typeof body.secure === "boolean" ? body.secure : undefined,
      user: str(body.user, 254),
      password: typeof body.password === "string" && body.password ? body.password.slice(0, 500) : undefined,
      clearPassword: body.clearPassword === true,
      from: str(body.from, 254),
    },
    user.userId,
  );
  await recordAudit({ userId: user.userId, action: "admin_mail_config_updated" });
  return NextResponse.json({ ok: true, mail });
}
