"use client";

import { useState } from "react";
import { Card } from "@/components/dashboard/Card";
import type { MailConfigView } from "@/lib/mail";

const input = "mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm";

export function MailAdmin({ initial, adminEmail }: { initial: MailConfigView; adminEmail: string }) {
  const [cfg, setCfg] = useState(initial);
  const [password, setPassword] = useState("");
  const [testTo, setTestTo] = useState(adminEmail);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function post(payload: object, kind: "save" | "test") {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Fehlgeschlagen." });
        return;
      }
      if (data.mail) {
        setCfg(data.mail);
        setPassword("");
      }
      setMsg({ ok: true, text: kind === "test" ? "Testmail gesendet." : "Gespeichert." });
    } finally {
      setBusy(null);
    }
  }

  const save = (clearPassword = false) =>
    post(
      {
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        user: cfg.user,
        from: cfg.from,
        password: password || undefined,
        clearPassword: clearPassword || undefined,
      },
      "save",
    );

  return (
    <Card
      title="Mail (SMTP)"
      subtitle="Für E-Mail-Bestätigung und Passwort-Reset. Ohne Host sind neue Konten sofort aktiv."
    >
      <div className="space-y-3">
        <p className={`text-xs font-medium ${cfg.configured ? "text-emerald-600" : "text-amber-700"}`}>
          {cfg.configured ? "Mail aktiv" : "Nicht konfiguriert – Bestätigungspflicht und Reset-Mails sind aus"}
          {cfg.usesEnvFallback && " (Werte aus Env-Variablen)"}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-xs text-neutral-500 sm:col-span-2">
            SMTP-Host
            <input className={input} value={cfg.host} placeholder="smtp.example.com" onChange={(e) => setCfg({ ...cfg, host: e.target.value })} />
          </label>
          <label className="block text-xs text-neutral-500">
            Port
            <input className={input} type="number" min={1} max={65535} value={cfg.port} onChange={(e) => setCfg({ ...cfg, port: Number(e.target.value) })} />
          </label>
          <label className="block text-xs text-neutral-500">
            Benutzer
            <input className={input} value={cfg.user} autoComplete="off" onChange={(e) => setCfg({ ...cfg, user: e.target.value })} />
          </label>
          <label className="block text-xs text-neutral-500 sm:col-span-2">
            Passwort
            <input
              className={input}
              type="password"
              autoComplete="new-password"
              value={password}
              placeholder={cfg.hasPassword ? "•••••••• (gesetzt – leer lassen zum Behalten)" : "Passwort eingeben"}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="block text-xs text-neutral-500 sm:col-span-2">
            Absender
            <input className={input} value={cfg.from} placeholder="Brick <no-reply@example.com>" onChange={(e) => setCfg({ ...cfg, from: e.target.value })} />
          </label>
          <label className="flex items-end gap-2 pb-1.5 text-sm text-neutral-700">
            <input type="checkbox" checked={cfg.secure} onChange={(e) => setCfg({ ...cfg, secure: e.target.checked })} />
            SSL/TLS (Port 465)
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => save()} disabled={busy !== null} className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40">
            {busy === "save" ? "…" : "Speichern"}
          </button>
          {cfg.hasPassword && (
            <button type="button" onClick={() => save(true)} disabled={busy !== null} className="text-xs text-red-500 hover:text-red-600 disabled:opacity-40">
              Passwort entfernen
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-neutral-200 pt-3">
          <label className="block text-xs text-neutral-500">
            Testmail an
            <input className={input} type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          </label>
          <button onClick={() => post({ test: true, to: testTo }, "test")} disabled={busy !== null || !cfg.configured} className="rounded-lg border border-neutral-300 px-3.5 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-40">
            {busy === "test" ? "Sende…" : "Testmail senden"}
          </button>
        </div>
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      </div>
    </Card>
  );
}
