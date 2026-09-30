"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthFrame from "@/components/marketing/AuthFrame";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      const data: { error?: string; details?: string[] } = await res.json().catch(() => ({}));
      if (data.error === "WEAK_PASSWORD") setError(data.details?.join(" ") || "Passwort zu schwach.");
      else if (data.error === "INVALID_TOKEN") setError("Der Link ist ungültig oder abgelaufen. Fordere einen neuen an.");
      else setError("Zurücksetzen fehlgeschlagen. Bitte erneut versuchen.");
    } catch {
      setError("Zurücksetzen fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-[15px] font-medium text-emerald-800">Passwort geändert.</p>
        <Link href="/auth/login" className="btn-pop w-full px-4 py-3 text-center">Zur Anmeldung</Link>
      </div>
    );
  }

  const input = "w-full border border-neutral-200 px-4 py-3 text-neutral-900 outline-none";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="rp-pw" className="text-sm font-semibold text-neutral-700">Neues Passwort</label>
        <input id="rp-pw" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="rp-confirm" className="text-sm font-semibold text-neutral-700">Passwort bestätigen</label>
        <input id="rp-confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
      </div>
      {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</p>}
      <button type="submit" disabled={loading || !token} className="btn-pop w-full px-4 py-3">{loading ? "Speichern…" : "Passwort speichern"}</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthFrame emoji="🔒" title="Neues Passwort" subtitle="Wähle ein neues, sicheres Passwort.">
      <Suspense fallback={null}><ResetForm /></Suspense>
    </AuthFrame>
  );
}
