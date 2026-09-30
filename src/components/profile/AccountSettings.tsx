"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/dashboard/Card";

export function AccountSettings({
  name,
  email,
  canChangePassword,
}: {
  name: string;
  email: string;
  canChangePassword: boolean;
}) {
  const router = useRouter();
  const [nameValue, setNameValue] = useState(name);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName() {
    setSavingName(true);
    setNameMsg(null);
    try {
      const res = await fetch("/api/profile/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue }),
      });
      if (res.ok) {
        setNameMsg("Gespeichert.");
        router.refresh();
      } else {
        setNameMsg("Fehler beim Speichern.");
      }
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword() {
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPasswordMsg({ ok: true, text: "Passwort geändert." });
        setCurrentPassword("");
        setNewPassword("");
        setShowPasswordForm(false);
      } else {
        const map: Record<string, string> = {
          WRONG_PASSWORD: "Aktuelles Passwort ist falsch.",
          WEAK_PASSWORD: "Neues Passwort muss mind. 8 Zeichen haben.",
          NO_PASSWORD_ACCOUNT: "Dieser Account nutzt kein Passwort (Google-Login).",
        };
        setPasswordMsg({ ok: false, text: map[data.error] ?? "Fehler beim Ändern." });
      }
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <Card title="Account" subtitle="Name, E-Mail und Anmeldedaten">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-neutral-500">
            Name
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              className="mt-1 block w-56 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={saveName}
            disabled={savingName || nameValue.trim() === name}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {savingName ? "…" : "Speichern"}
          </button>
          {nameMsg && <span className="text-xs text-neutral-500">{nameMsg}</span>}
        </div>

        <div>
          <p className="text-xs text-neutral-500">E-Mail</p>
          <p className="mt-1 text-sm text-neutral-900">{email}</p>
        </div>

        {canChangePassword ? (
          <div className="border-t border-neutral-100 pt-4">
            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-neutral-400"
              >
                Passwort ändern
              </button>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-neutral-500">
                  Aktuelles Passwort
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="mt-1 block w-44 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-neutral-500">
                  Neues Passwort
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 block w-44 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
                  />
                </label>
                <button
                  onClick={changePassword}
                  disabled={savingPassword || !currentPassword || newPassword.length < 8}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  {savingPassword ? "…" : "Ändern"}
                </button>
                <button
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setPasswordMsg(null);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-800"
                >
                  Abbrechen
                </button>
              </div>
            )}
            {passwordMsg && (
              <p className={`mt-2 text-xs ${passwordMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                {passwordMsg.text}
              </p>
            )}
          </div>
        ) : (
          <p className="border-t border-neutral-100 pt-4 text-xs text-neutral-400">
            Anmeldung über Google – Passwort wird dort verwaltet.
          </p>
        )}
      </div>
    </Card>
  );
}
