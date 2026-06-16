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
    <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1E293B] bg-[#111827] p-6 shadow-2xl sm:p-8">
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-[#1E293B] bg-[#0B1120] p-1">
        <button
          type="button"
          onClick={() => setTab("login")}
          aria-pressed={tab === "login"}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === "login"
              ? "bg-[#F0A500] text-[#0B1120]"
              : "text-[#94A3B8] hover:text-[#F8FAFC]"
          }`}
        >
          Anmelden
        </button>
        <button
          type="button"
          onClick={() => setTab("register")}
          aria-pressed={tab === "register"}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === "register"
              ? "bg-[#F0A500] text-[#0B1120]"
              : "text-[#94A3B8] hover:text-[#F8FAFC]"
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
