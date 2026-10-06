"use client";

import { useState } from "react";

interface Device {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "nie";
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export default function DevicePairing({ initialCode, devices: initial }: { initialCode: string; devices: Device[] }) {
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [devices, setDevices] = useState(initial);

  async function decide(decision: "allow" | "deny") {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/device/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode: code, decision }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; clientName?: string };
      if (!res.ok || !data.ok) {
        setMessage({ ok: false, text: data.error ?? "Freigabe fehlgeschlagen." });
      } else {
        setMessage({
          ok: true,
          text:
            decision === "allow"
              ? `„${data.clientName}“ ist gekoppelt. Der Fernseher meldet sich in wenigen Sekunden an.`
              : "Kopplung abgelehnt.",
        });
        setCode("");
      }
    } catch {
      setMessage({ ok: false, text: "Netzwerkfehler. Bitte erneut versuchen." });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/device/tokens?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setDevices((list) => list.filter((d) => d.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
        Code vom Fernseher
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={12}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em]"
        />
      </label>
      <p className="text-xs text-neutral-500">
        Das Gerät erhält Zugriff auf dein Profil (FTP), geplante Rad- und Kraft-Einheiten und darf
        aufgezeichnete Einheiten als Aktivität speichern.
      </p>

      {message && (
        <p
          role="alert"
          className={`rounded-2xl px-4 py-2.5 text-sm font-medium ${
            message.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy || code.replace(/[^A-Za-z]/g, "").length !== 8}
          onClick={() => decide("allow")}
          className="btn-pop flex-1 px-4 py-3"
        >
          Koppeln
        </button>
        <button type="button" disabled={busy || !code} onClick={() => decide("deny")} className="btn-soft flex-1 px-4 py-3">
          Ablehnen
        </button>
      </div>

      {devices.length > 0 && (
        <div className="border-t border-neutral-200 pt-4">
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">Gekoppelte Geräte</h2>
          <ul className="flex flex-col gap-2">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-4 py-2.5 text-sm">
                <span>
                  <strong className="block text-neutral-900">{d.name}</strong>
                  <span className="text-xs text-neutral-500">
                    gekoppelt {fmtDate(d.createdAt)} · zuletzt aktiv {fmtDate(d.lastUsedAt)}
                  </span>
                </span>
                <button type="button" onClick={() => revoke(d.id)} className="btn-soft px-3 py-1.5 text-xs">
                  Entkoppeln
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
