"use client";

import { useState } from "react";

interface Props {
  clientName: string;
  redirectHost: string;
  /** Unveränderte Autorisierungs-Parameter; der Server validiert sie erneut. */
  params: Record<string, string>;
}

export default function ConsentForm({ clientName, redirectHost, params }: Props) {
  const [grantWrite, setGrantWrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "allow" | "deny") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/oauth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params, decision, grantWrite }),
      });
      const data = (await res.json().catch(() => ({}))) as { redirectTo?: string; error_description?: string };
      if (!res.ok || !data.redirectTo) {
        setError(data.error_description ?? "Die Anfrage konnte nicht verarbeitet werden.");
        setBusy(false);
        return;
      }
      // Navigation (kein Formular-Submit): die CSP-Regel form-action 'self' greift hier nicht.
      window.location.href = data.redirectTo;
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700">
        <p>
          <strong>{clientName}</strong> möchte sich mit deinem LocalHub-Konto verbinden. Nach der
          Freigabe leitet dein Browser zu <strong>{redirectHost}</strong> weiter.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Training, Form, Aktivitäten, Plan, Befinden und Profil lesen</li>
        </ul>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 p-4 text-sm">
        <input
          type="checkbox"
          checked={grantWrite}
          onChange={(e) => setGrantWrite(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <strong className="block text-neutral-900">Trainingsplan ändern erlauben</strong>
          <span className="text-neutral-500">
            Offene, geplante Einheiten dürfen ersetzt werden. Absolvierte Aktivitäten bleiben unangetastet.
            Nur aktivieren, wenn Claude den Plan anpassen soll.
          </span>
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="button" disabled={busy} onClick={() => decide("allow")} className="btn-pop flex-1 px-4 py-3">
          Zugriff erlauben
        </button>
        <button type="button" disabled={busy} onClick={() => decide("deny")} className="btn-soft flex-1 px-4 py-3">
          Abbrechen
        </button>
      </div>
      <p className="text-center text-xs text-neutral-400">
        Den Zugriff kannst du jederzeit widerrufen (siehe docs/MCP.md).
      </p>
    </div>
  );
}
