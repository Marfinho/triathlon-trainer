"use client";

import { useState } from "react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

type Tab = "login" | "register";

/**
 * Inline-Auth mit Tabs (Anmelden / Registrieren) für die Landingpage.
 * Verwendet dieselben Formular-Komponenten wie die /auth-Seiten.
 */
export default function AuthTabs() {
  const [tab, setTab] = useState<Tab>("register");

  return (
    <div className="mx-auto w-full max-w-md rounded-[32px] border border-neutral-200 bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-neutral-200 bg-neutral-100 p-1">
        <button
          type="button"
          onClick={() => setTab("login")}
          aria-pressed={tab === "login"}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            tab === "login"
              ? "bg-neutral-900 text-neutral-50"
              : "text-neutral-500 hover:text-neutral-900"
          }`}
        >
          Anmelden
        </button>
        <button
          type="button"
          onClick={() => setTab("register")}
          aria-pressed={tab === "register"}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            tab === "register"
              ? "bg-neutral-900 text-neutral-50"
              : "text-neutral-500 hover:text-neutral-900"
          }`}
        >
          Registrieren
        </button>
      </div>

      {tab === "login" ? (
        <LoginForm showRegisterLink={false} />
      ) : (
        <RegisterForm showLoginLink={false} />
      )}
    </div>
  );
}
