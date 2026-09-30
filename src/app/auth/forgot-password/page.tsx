"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import AuthFrame from "@/components/marketing/AuthFrame";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) setError("Zu viele Anfragen. Bitte später erneut versuchen.");
      else if (!res.ok) setError("Anfrage fehlgeschlagen. Bitte erneut versuchen.");
      else setDone(true);
    } catch {
      setError("Anfrage fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame emoji="🔑" title="Passwort vergessen" subtitle="Wir schicken dir einen Link zum Zurücksetzen.">
      {done ? (
        <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-[15px] font-medium text-emerald-800">
          Falls ein Konto mit dieser Adresse existiert, ist eine Mail mit dem Reset-Link unterwegs.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fp-email" className="text-sm font-semibold text-neutral-700">E-Mail</label>
            <input id="fp-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@example.com" className="w-full border border-neutral-200 px-4 py-3 text-neutral-900 outline-none" />
          </div>
          {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</p>}
          <button type="submit" disabled={loading} className="btn-pop w-full px-4 py-3">{loading ? "Senden…" : "Link senden"}</button>
        </form>
      )}
      <p className="pt-4 text-center text-sm text-neutral-500">
        <Link href="/auth/login" className="font-semibold text-blue-600 hover:underline">Zurück zur Anmeldung</Link>
      </p>
    </AuthFrame>
  );
}
