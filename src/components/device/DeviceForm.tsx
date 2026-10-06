"use client";

import { useState } from "react";

type Step = "enter" | "confirm" | "done" | "denied";

export default function DeviceForm({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [step, setStep] = useState<Step>("enter");
  const [deviceName, setDeviceName] = useState("");
  const [ageSec, setAgeSec] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(action: "lookup" | "approve" | "deny") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/device/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_code: code, action }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        deviceName?: string;
        requestedAgoSec?: number;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Die Anfrage konnte nicht verarbeitet werden.");
        return;
      }
      if (action === "lookup") {
        setDeviceName(data.deviceName ?? "");
        setAgeSec(data.requestedAgoSec ?? 0);
        setStep("confirm");
      } else {
        setStep(action === "approve" ? "done" : "denied");
      }
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        Gekoppelt! Dein Gerät meldet sich in wenigen Sekunden an. Du kannst dieses Fenster schließen.
        Unter „Profil &amp; Einstellungen“ kannst du Geräte jederzeit wieder entkoppeln.
      </p>
    );
  }
  if (step === "denied") {
    return (
      <p role="status" className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
        Abgelehnt. Es wurde nichts freigegeben.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {step === "enter" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void call("lookup");
          }}
          className="flex flex-col gap-4"
        >
          <label className="text-sm font-medium text-neutral-700" htmlFor="device-code">
            Kopplungscode
          </label>
          <input
            id="device-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 12))}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            placeholder="ABCD"
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-center font-mono text-3xl tracking-[0.4em] uppercase"
          />
          <button
            type="submit"
            disabled={busy || code.trim().length < 4}
            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Weiter
          </button>
        </form>
      ) : (
        <>
          <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700">
            <p>
              Ein Gerät mit dem Namen <strong>{deviceName}</strong> möchte sich mit deinem Konto verbinden
              {ageSec > 0 ? ` (angefragt vor ${ageSec < 90 ? `${ageSec} s` : `${Math.round(ageSec / 60)} min`})` : ""}.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Geplante Rad-, Kraft- und Mobility-Einheiten lesen</li>
              <li>Aufgezeichnete Einheiten speichern und den Live-Zustand teilen</li>
            </ul>
            <p className="mt-3 text-neutral-500">
              Bestätige nur, wenn du den Code gerade selbst auf deinem Fernseher siehst.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void call("approve")}
              className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Koppeln
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void call("deny")}
              className="flex-1 rounded-2xl border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
            >
              Ablehnen
            </button>
          </div>
        </>
      )}
      {error ? (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
