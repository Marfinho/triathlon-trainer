"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

type RegisterFormProps = {
  /** Show the "Bereits ein Konto?" footer link (hidden inside the inline AuthTabs). */
  showLoginLink?: boolean;
};

type RegisterError = "EMAIL_TAKEN" | "WEAK_PASSWORD" | "INVALID_EMAIL" | string;

function mapError(code: RegisterError): string {
  switch (code) {
    case "EMAIL_TAKEN":
      return "E-Mail bereits vergeben";
    case "WEAK_PASSWORD":
      return "Passwort zu kurz";
    case "TERMS_REQUIRED":
      return "Bitte stimme den AGB und der Datenschutzerklärung zu.";
    case "INVALID_EMAIL":
      return "Ungültige E-Mail-Adresse";
    default:
      return "Registrierung fehlgeschlagen. Bitte erneut versuchen.";
  }
}

/**
 * Registrierungsformular (Name/E-Mail/Passwort + Bestätigung + Google).
 * Wird auf /auth/register und inline in den AuthTabs verwendet.
 */
export default function RegisterForm({ showLoginLink = true }: RegisterFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [terms, setTerms] = useState(false);
  const [website, setWebsite] = useState("");
  const [resent, setResent] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== confirm) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }

    if (!terms) {
      setError(mapError("TERMS_REQUIRED"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, acceptTerms: terms, website }),
      });

      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        setError(mapError(data.error ?? ""));
        return;
      }

      const data: { verificationRequired?: boolean } = await res.json().catch(() => ({}));
      if (data.verificationRequired) {
        setSentTo(email);
        return;
      }

      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        setError("Konto erstellt, aber Anmeldung fehlgeschlagen. Bitte anmelden.");
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Registrierung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-3 text-[15px] text-neutral-700">
        <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
          Fast geschafft! Wir haben dir eine Bestätigungsmail an <strong>{sentTo}</strong> geschickt.
        </p>
        <p>Klicke auf den Link in der Mail, um dein Konto zu aktivieren (24 Stunden gültig). Schau ggf. auch im Spam-Ordner nach.</p>
        <button
          type="button"
          disabled={resent}
          onClick={async () => {
            await fetch("/api/auth/resend-verification", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: sentTo }),
            }).catch(() => undefined);
            setResent(true);
          }}
          className="text-left font-semibold text-blue-600 hover:underline disabled:text-neutral-400 disabled:no-underline"
        >
          {resent ? "Mail wurde erneut gesendet." : "Keine Mail erhalten? Erneut senden"}
        </button>
        <button type="button" onClick={() => setSentTo(null)} className="text-left text-neutral-500 hover:underline">
          Falsche Adresse? Neu eintragen
        </button>
        <Link href="/auth/login" className="font-semibold text-blue-600 hover:underline">Zur Anmeldung</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reg-name"
          className="text-sm font-semibold text-neutral-700"
        >
          Name
        </label>
        <input
          id="reg-name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dein Name"
          className="w-full border border-neutral-200 px-4 py-3 text-neutral-900 outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reg-email"
          className="text-sm font-semibold text-neutral-700"
        >
          E-Mail
        </label>
        <input
          id="reg-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="du@example.com"
          className="w-full border border-neutral-200 px-4 py-3 text-neutral-900 outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reg-password"
          className="text-sm font-semibold text-neutral-700"
        >
          Passwort
        </label>
        <input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mindestens 8 Zeichen"
          className="w-full border border-neutral-200 px-4 py-3 text-neutral-900 outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reg-confirm"
          className="text-sm font-semibold text-neutral-700"
        >
          Passwort bestätigen
        </label>
        <input
          id="reg-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="w-full border border-neutral-200 px-4 py-3 text-neutral-900 outline-none"
        />
      </div>

      {/* Honeypot – nicht ausfüllen */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <label className="flex items-start gap-2.5 text-sm text-neutral-600">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1" />
        <span>
          Ich akzeptiere die{" "}
          <Link href="/legal/agb" target="_blank" className="font-semibold text-blue-600 hover:underline">AGB</Link>{" "}
          und habe die{" "}
          <Link href="/legal/datenschutz" target="_blank" className="font-semibold text-blue-600 hover:underline">Datenschutzerklärung</Link>{" "}
          gelesen.
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-pop mt-1 w-full px-4 py-3"
      >
        {loading ? "Konto wird erstellt…" : "Konto erstellen"}
      </button>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs font-medium text-neutral-400">oder</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <button
        type="button"
        onClick={() => signIn("google", { redirectTo: "/dashboard" })}
        className="btn-soft w-full px-4 py-3"
      >
        Mit Google
      </button>
      <p className="-mt-2 text-center text-xs text-neutral-400">
        Mit der Google-Anmeldung stimmst du den{" "}
        <Link href="/legal/agb" target="_blank" className="underline">AGB</Link> und der{" "}
        <Link href="/legal/datenschutz" target="_blank" className="underline">Datenschutzerklärung</Link> zu.
      </p>

      {showLoginLink && (
        <p className="pt-1 text-center text-sm text-neutral-500">
          Bereits ein Konto?{" "}
          <Link href="/auth/login" className="font-semibold text-blue-600 hover:underline">
            Anmelden
          </Link>
        </p>
      )}
    </form>
  );
}
