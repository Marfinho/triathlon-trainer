
/**
 * Mail-Versand per SMTP (nodemailer). Konfiguration: Admin-Bereich (Tabelle
 * `MailConfig`), ersatzweise die Env-Variablen SMTP_HOST, SMTP_PORT (587),
 * SMTP_USER, SMTP_PASS, SMTP_SECURE (true bei 465) und MAIL_FROM.
 * Ohne Host ist Mail "nicht konfiguriert": die Registrierung überspringt dann
 * die Bestätigungspflicht, damit die App trotzdem nutzbar bleibt.
 */
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto";

export interface MailSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/** Effektive Konfiguration: DB-Werte haben Vorrang vor Env-Variablen. */
export async function getMailSettings(): Promise<MailSettings | null> {
  let row: {
    host: string | null; port: number | null; secure: boolean | null;
    user: string | null; password: string | null; fromAddr: string | null;
  } | null = null;
  try {
    row = await prisma.mailConfig.findUnique({ where: { id: "singleton" } });
  } catch {
    row = null;
  }
  const host = row?.host || process.env.SMTP_HOST;
  if (!host) return null;
  const port = row?.port || Number(process.env.SMTP_PORT) || 587;
  let pass = process.env.SMTP_PASS ?? "";
  if (row?.password) {
    try {
      pass = decryptApiKey(row.password);
    } catch {
      /* Env-Fallback */
    }
  }
  const user = row?.user ?? process.env.SMTP_USER ?? "";
  return {
    host,
    port,
    secure:
      row?.secure ??
      (process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465),
    user,
    pass,
    from: row?.fromAddr || process.env.MAIL_FROM || user || "no-reply@localhost",
  };
}

export async function isMailConfigured(): Promise<boolean> {
  return (await getMailSettings()) !== null;
}

export function appUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function createTransporter(c: MailSettings): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: c.user ? { user: c.user, pass: c.pass } : undefined,
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Versendet eine Mail. Gibt eine Fehlermeldung zurück (statt zu werfen), wenn
 * der Versand scheitert bzw. Mail nicht konfiguriert ist; `null` = Erfolg.
 */
export async function sendMailDetailed(input: MailInput): Promise<string | null> {
  const cfg = await getMailSettings();
  if (!cfg) return "Mail ist nicht konfiguriert.";
  try {
    await createTransporter(cfg).sendMail({ from: cfg.from, ...input });
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mail] Versand fehlgeschlagen:", msg);
    return msg;
  }
}

export async function sendMail(input: MailInput): Promise<boolean> {
  return (await sendMailDetailed(input)) === null;
}

export interface MailConfigView {
  host: string; port: number; secure: boolean; user: string; from: string;
  hasPassword: boolean; configured: boolean; usesEnvFallback: boolean;
  updatedAt: string | null; updatedBy: string | null;
}

/** Adminsicht; das Passwort wird nie ausgegeben. */
export async function getMailConfigView(): Promise<MailConfigView> {
  let row = null;
  try {
    row = await prisma.mailConfig.findUnique({ where: { id: "singleton" } });
  } catch {
    row = null;
  }
  const eff = await getMailSettings();
  return {
    host: row?.host ?? process.env.SMTP_HOST ?? "",
    port: row?.port ?? (Number(process.env.SMTP_PORT) || 587),
    secure: eff?.secure ?? false,
    user: row?.user ?? process.env.SMTP_USER ?? "",
    from: row?.fromAddr ?? process.env.MAIL_FROM ?? "",
    hasPassword: Boolean(row?.password || process.env.SMTP_PASS),
    configured: eff !== null,
    usesEnvFallback: !row?.host && Boolean(process.env.SMTP_HOST),
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    updatedBy: row?.updatedBy ?? null,
  };
}

export interface MailConfigInput {
  host?: string; port?: number; secure?: boolean; user?: string;
  password?: string; clearPassword?: boolean; from?: string;
}

export async function setMailConfig(input: MailConfigInput, updatedBy?: string): Promise<MailConfigView> {
  const data: Record<string, unknown> = { updatedBy: updatedBy ?? null };
  if (typeof input.host === "string") data.host = input.host.trim() || null;
  if (typeof input.port === "number") data.port = input.port;
  if (typeof input.secure === "boolean") data.secure = input.secure;
  if (typeof input.user === "string") data.user = input.user.trim() || null;
  if (typeof input.from === "string") data.fromAddr = input.from.trim() || null;
  if (input.clearPassword) data.password = null;
  else if (input.password) data.password = encryptApiKey(input.password);
  await prisma.mailConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  return getMailConfigView();
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
