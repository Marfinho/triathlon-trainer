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

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        setError(mapError(data.error ?? ""));
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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reg-name"
          className="font-display text-xs uppercase tracking-wider text-[#A9A9C4]"
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
          className="w-full rounded-lg border border-[#34344D] bg-[#07070D] px-3 py-2.5 text-[#F1F1FB] placeholder:text-[#6B6B8A] outline-none transition focus:border-[#FF2BD6] focus:ring-1 focus:ring-[#FF2BD6]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reg-email"
          className="font-display text-xs uppercase tracking-wider text-[#A9A9C4]"
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
          className="w-full rounded-lg border border-[#34344D] bg-[#07070D] px-3 py-2.5 text-[#F1F1FB] placeholder:text-[#6B6B8A] outline-none transition focus:border-[#FF2BD6] focus:ring-1 focus:ring-[#FF2BD6]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reg-password"
          className="font-display text-xs uppercase tracking-wider text-[#A9A9C4]"
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
          className="w-full rounded-lg border border-[#34344D] bg-[#07070D] px-3 py-2.5 text-[#F1F1FB] placeholder:text-[#6B6B8A] outline-none transition focus:border-[#FF2BD6] focus:ring-1 focus:ring-[#FF2BD6]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reg-confirm"
          className="font-display text-xs uppercase tracking-wider text-[#A9A9C4]"
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
          className="w-full rounded-lg border border-[#34344D] bg-[#07070D] px-3 py-2.5 text-[#F1F1FB] placeholder:text-[#6B6B8A] outline-none transition focus:border-[#FF2BD6] focus:ring-1 focus:ring-[#FF2BD6]"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-[#FF6B8B]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full rounded-lg bg-[#FF2BD6] px-4 py-2.5 font-medium text-[#07070D] transition hover:bg-[#FF5FE0] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Konto wird erstellt…" : "Konto erstellen"}
      </button>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-[#1C1C2D]" />
        <span className="font-display text-xs text-[#A9A9C4]">oder</span>
        <span className="h-px flex-1 bg-[#1C1C2D]" />
      </div>

      <button
        type="button"
        onClick={() => signIn("google", { redirectTo: "/dashboard" })}
        className="w-full rounded-lg border border-[#34344D] bg-[#11111B] px-4 py-2.5 font-medium text-[#F1F1FB] transition hover:border-[#6B6B8A]"
      >
        Mit Google
      </button>

      {showLoginLink && (
        <p className="pt-1 text-center text-sm text-[#A9A9C4]">
          Bereits ein Konto?{" "}
          <Link href="/auth/login" className="text-[#FF2BD6] hover:underline">
            Anmelden
          </Link>
        </p>
      )}
    </form>
  );
}
