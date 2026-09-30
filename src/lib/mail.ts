import nodemailer from "nodemailer";

/**
 * Mail-Versand per SMTP (nodemailer). Konfiguration über Umgebungsvariablen:
 * SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, SMTP_SECURE (true bei 465),
 * MAIL_FROM (z. B. "Brick <no-reply@example.com>").
 * Ohne SMTP_HOST ist Mail "nicht konfiguriert": die Registrierung überspringt
 * dann die Bestätigungspflicht, damit die App trotzdem nutzbar bleibt.
 */
export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export function appUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Versendet eine Mail. Gibt false zurück (statt zu werfen), wenn der Versand scheitert. */
export async function sendMail(input: MailInput): Promise<boolean> {
  if (!isMailConfigured()) return false;
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "no-reply@localhost",
      ...input,
    });
    return true;
  } catch (err) {
    console.error("[mail] Versand fehlgeschlagen:", err instanceof Error ? err.message : err);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function layout(title: string, intro: string, url: string, cta: string, note: string): Pick<MailInput, "html" | "text"> {
  const safeUrl = escapeHtml(url);
  return {
    text: `${title}\n\n${intro}\n\n${cta}: ${url}\n\n${note}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#171717">
<h2>${escapeHtml(title)}</h2><p>${escapeHtml(intro)}</p>
<p><a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">${escapeHtml(cta)}</a></p>
<p style="font-size:13px;color:#737373">Falls der Button nicht funktioniert:<br>${safeUrl}</p>
<p style="font-size:13px;color:#737373">${escapeHtml(note)}</p></div>`,
  };
}

export function sendVerificationMail(to: string, token: string): Promise<boolean> {
  const url = `${appUrl()}/auth/verify?token=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: "Bitte bestätige deine E-Mail-Adresse",
    ...layout(
      "Willkommen bei Brick",
      "Bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren. Der Link ist 24 Stunden gültig.",
      url,
      "E-Mail bestätigen",
      "Du hast dich nicht registriert? Dann ignoriere diese Mail einfach.",
    ),
  });
}

export function sendPasswordResetMail(to: string, token: string): Promise<boolean> {
  const url = `${appUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: "Passwort zurücksetzen",
    ...layout(
      "Passwort zurücksetzen",
      "Über den folgenden Link kannst du ein neues Passwort setzen. Er ist 1 Stunde gültig.",
      url,
      "Neues Passwort setzen",
      "Du hast das nicht angefordert? Dann ignoriere diese Mail – dein Passwort bleibt unverändert.",
    ),
  });
}
