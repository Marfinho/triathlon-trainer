"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
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

  const [newEmail, setNewEmail] = useState("");
  const [emailPw, setEmailPw] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePw, setDeletePw] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  async function changeEmail() {
    setEmailMsg(null);
    const res = await fetch("/api/profile/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail, password: emailPw }),
    });
    const data = await res.json().catch(() => ({}));
    const map: Record<string, string> = {
      INVALID_EMAIL: "Ungültige E-Mail-Adresse.",
      WRONG_PASSWORD: "Passwort ist falsch.",
      SAME_EMAIL: "Das ist bereits deine Adresse.",
      MAIL_NOT_CONFIGURED: "Mail-Versand ist nicht eingerichtet.",
      TOO_MANY_REQUESTS: "Zu viele Versuche. Bitte später erneut.",
    };
    if (res.ok) {
      setEmailMsg({ ok: true, text: "Bestätigungslink an die neue Adresse gesendet." });
      setNewEmail("");
      setEmailPw("");
      setShowEmailForm(false);
    } else {
      setEmailMsg({ ok: false, text: map[data.error] ?? "Fehler beim Ändern." });
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const res = await fetch("/api/profile/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: deleteConfirm, password: deletePw || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await signOut({ redirectTo: "/" });
        return;
      }
      const map: Record<string, string> = {
        WRONG_PASSWORD: "Passwort ist falsch.",
        CONFIRM_REQUIRED: "Bitte LÖSCHEN eintippen.",
        BILLING_CANCEL_FAILED: "Abo konnte nicht beendet werden. Bitte Support kontaktieren.",
      };
      setDeleteMsg(map[data.error] ?? "Löschen fehlgeschlagen.");
    } finally {
      setDeleting(false);
    }
  }

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
          {canChangePassword && (
            <div className="mt-2">
              {!showEmailForm ? (
                <button onClick={() => setShowEmailForm(true)} className="text-xs font-medium text-blue-600 hover:underline">
                  E-Mail-Adresse ändern
                </button>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs text-neutral-500">
                    Neue Adresse
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="mt-1 block w-56 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm" />
                  </label>
                  <label className="text-xs text-neutral-500">
                    Passwort
                    <input type="password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} className="mt-1 block w-44 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm" />
                  </label>
                  <button onClick={changeEmail} disabled={!newEmail || !emailPw} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40">
                    Bestätigung senden
                  </button>
                </div>
              )}
              {emailMsg && <p className={`mt-1 text-xs ${emailMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{emailMsg.text}</p>}
            </div>
          )}
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

        <div className="border-t border-neutral-100 pt-4">
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} className="text-xs font-medium text-red-600 hover:underline">
              Konto und alle Daten löschen
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-800">
                Alle deine Daten (Aktivitäten, Pläne, Integrationen) werden unwiderruflich gelöscht, ein laufendes Abo wird beendet.
                Exportiere vorher ggf. ein Backup.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-neutral-600">
                  Zur Bestätigung LÖSCHEN eintippen
                  <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="mt-1 block w-44 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm" />
                </label>
                {canChangePassword && (
                  <label className="text-xs text-neutral-600">
                    Passwort
                    <input type="password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} className="mt-1 block w-44 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm" />
                  </label>
                )}
                <button
                  onClick={deleteAccount}
                  disabled={deleting || deleteConfirm !== "LÖSCHEN" || (canChangePassword && !deletePw)}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40"
                >
                  {deleting ? "…" : "Endgültig löschen"}
                </button>
                <button onClick={() => setShowDelete(false)} className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-800">
                  Abbrechen
                </button>
              </div>
              {deleteMsg && <p className="text-xs text-red-700">{deleteMsg}</p>}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
