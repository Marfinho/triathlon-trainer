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
    <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1C1C2D] bg-[#11111B] p-6 shadow-2xl sm:p-8">
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-[#1C1C2D] bg-[#07070D] p-1">
        <button
          type="button"
          onClick={() => setTab("login")}
          aria-pressed={tab === "login"}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === "login"
              ? "bg-[#FF2BD6] text-[#07070D]"
              : "text-[#A9A9C4] hover:text-[#F1F1FB]"
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
              ? "bg-[#FF2BD6] text-[#07070D]"
              : "text-[#A9A9C4] hover:text-[#F1F1FB]"
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
