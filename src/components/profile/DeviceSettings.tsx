"use client";

import { useState } from "react";
import { Card } from "@/components/dashboard/Card";

export interface PairedDevice {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

/** Vollständige Feed-URL (der Token steckt in der URL, weil Kalender-Clients keinen Header senden). */
function feedUrl(token: string): string {
  return `${window.location.origin}/api/calendar/v1/training.ics?token=${token}`;
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "nie";
}

const SCOPE_LABEL: Record<string, string> = { tv: "TV-App", voice: "Sprachassistent", calendar: "Kalender" };

/** Gekoppelte Geräte (Fire-TV-App o. ä.) und Sprachassistent-Token anzeigen, erzeugen und widerrufen. */
export function DeviceSettings({ initial }: { initial: PairedDevice[] }) {
  const [devices, setDevices] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [tokenScope, setTokenScope] = useState<"voice" | "calendar">("voice");
  const [voiceName, setVoiceName] = useState("Home Assistant");
  const [busy, setBusy] = useState(false);
  /** Klartext-Token: nur im Speicher, nur bis zum Schließen – wird nie erneut geladen. */
  const [created, setCreated] = useState<{ name: string; token: string; scope: "voice" | "calendar" } | null>(null);
  const [copied, setCopied] = useState(false);

  async function createVoiceToken() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/device/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: voiceName, scope: tokenScope }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Token konnte nicht erzeugt werden.");
      return;
    }
    const data = (await res.json()) as { id: string; name: string; token: string; prefix: string; scopes: string[] };
    setCreated({ name: data.name, token: data.token, scope: tokenScope });
    setCopied(false);
    setDevices((d) => [
      { id: data.id, name: data.name, prefix: data.prefix, scopes: data.scopes, lastUsedAt: null, createdAt: new Date().toISOString() },
      ...d,
    ]);
  }

  async function copyToken() {
    if (!created) return;
    const secret = created.scope === "calendar" ? feedUrl(created.token) : created.token;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setError("Kopieren nicht möglich – bitte den Token von Hand markieren.");
    }
  }

  async function revoke(id: string) {
    setError(null);
    const res = await fetch("/api/device/tokens", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    if (res?.ok) setDevices((d) => d.filter((x) => x.id !== id));
    else setError("Entkoppeln fehlgeschlagen.");
  }

  return (
    <Card
      title="Gekoppelte Geräte"
      subtitle="Fernseher-Apps (z. B. Fire TV) und Sprachassistenten, die auf deine Einheiten zugreifen dürfen"
      actions={
        <a
          href="/device"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Code eingeben
        </a>
      }
    >
      {devices.length === 0 ? (
        <p className="text-sm text-neutral-500">Noch kein Gerät gekoppelt.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-900">{d.name}</p>
                <p className="text-xs text-neutral-500">
                  {d.scopes.map((sc) => SCOPE_LABEL[sc] ?? sc).join(", ")} · {d.prefix} · gekoppelt {fmtDate(d.createdAt)} · zuletzt aktiv {fmtDate(d.lastUsedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void revoke(d.id)}
                className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
              >
                Entkoppeln
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 border-t border-neutral-100 pt-4">
        <h3 className="text-sm font-semibold text-neutral-900">Token für Sprachassistent oder Kalender</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Sprachassistent: liest nur den Sprechtext zu deinem Training (Home Assistant, Sonos, Alexa). Kalender: ICS-Feed
          mit deinem Plan zum Abonnieren. Jeder Token kann nur das, wofür er erzeugt wurde.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={tokenScope}
            onChange={(e) => setTokenScope(e.target.value as "voice" | "calendar")}
            aria-label="Art des Tokens"
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="voice">Sprachassistent</option>
            <option value="calendar">Kalender (ICS)</option>
          </select>
          <input
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            maxLength={40}
            aria-label="Name des Sprachassistent-Tokens"
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => void createVoiceToken()}
            disabled={busy}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {tokenScope === "voice" ? "Sprachassistent-Token erzeugen" : "Kalender-Token erzeugen"}
          </button>
        </div>
        {created ? (
          <div role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">
              Token „{created.name}“ – wird nur jetzt einmal angezeigt.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Kopiere ihn sofort und lege ihn sicher ab (z. B. in der Home-Assistant-Datei secrets.yaml). Wer den Token
              hat, kann deinen Trainingsplan {created.scope === "calendar" ? "als Kalenderfeed" : "als Sprechtext"} abrufen. Später ist er nicht mehr einsehbar; bei Verlust
              entkoppeln und neu erzeugen.
            </p>
            <code className="mt-2 block break-all rounded bg-white px-2 py-1.5 text-xs text-neutral-900">
              {created.scope === "calendar" ? feedUrl(created.token) : created.token}
            </code>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void copyToken()}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
              >
                {copied ? "Kopiert" : "Kopieren"}
              </button>
              <button
                type="button"
                onClick={() => setCreated(null)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Schließen
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </Card>
  );
}
