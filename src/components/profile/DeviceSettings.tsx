"use client";

import { useState } from "react";
import { Card } from "@/components/dashboard/Card";

export interface PairedDevice {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "nie";
}

/** Gekoppelte Geräte (Fire-TV-App o. ä.) anzeigen und entkoppeln. */
export function DeviceSettings({ initial }: { initial: PairedDevice[] }) {
  const [devices, setDevices] = useState(initial);
  const [error, setError] = useState<string | null>(null);

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
      subtitle="Fernseher-Apps (z. B. Fire TV), die auf deine Einheiten zugreifen dürfen"
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
                  {d.prefix} · gekoppelt {fmtDate(d.createdAt)} · zuletzt aktiv {fmtDate(d.lastUsedAt)}
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
      {error ? <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </Card>
  );
}
