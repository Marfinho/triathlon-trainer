"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/dashboard/Card";

export function IntegrationSettings({
  connected,
  athleteId,
  maxActiveIntegrations,
  activeIntegrations,
}: {
  connected: boolean;
  athleteId: string | null;
  maxActiveIntegrations: number;
  activeIntegrations: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [athleteIdValue, setAthleteIdValue] = useState(athleteId ?? "");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const atLimit =
    !connected && Number.isFinite(maxActiveIntegrations) && activeIntegrations >= maxActiveIntegrations;

  async function connect() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/intervals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: athleteIdValue, apiKey }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Verbunden." });
        setApiKey("");
        setEditing(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg({
          ok: false,
          text:
            data.error === "LIMIT_REACHED"
              ? "Limit für aktive Integrationen erreicht – bitte upgraden."
              : "Verbindung fehlgeschlagen.",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    setMsg(null);
    try {
      await fetch("/api/integrations/intervals", { method: "DELETE" });
      setMsg({ ok: true, text: "Trennung erfolgt." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Intervals.icu-Integration"
      subtitle="Aktivitäten-Quelle für Apple, Withings, Strava & mehr"
    >
      {connected && !editing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-900">
              Verbunden · Athlete-ID <span className="font-mono">{athleteId}</span>
            </p>
            <p className="mt-0.5 text-xs text-neutral-400">API-Key ist verschlüsselt gespeichert.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-neutral-400"
            >
              Ändern
            </button>
            <button
              onClick={disconnect}
              disabled={saving}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:border-red-300 disabled:opacity-40"
            >
              Trennen
            </button>
          </div>
        </div>
      ) : (
        <div>
          {atLimit ? (
            <p className="mb-3 text-sm text-amber-700">
              Dein Tier erlaubt {maxActiveIntegrations} aktive Integration
              {maxActiveIntegrations === 1 ? "" : "en"}. Upgrade für weitere.
            </p>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-500">
              Athlete-ID
              <input
                type="text"
                value={athleteIdValue}
                onChange={(e) => setAthleteIdValue(e.target.value)}
                placeholder="i123456"
                className="mt-1 block w-36 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-neutral-500">
              API-Key
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="••••••••"
                className="mt-1 block w-48 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={connect}
              disabled={saving || !athleteIdValue || !apiKey || atLimit}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {saving ? "…" : connected ? "Aktualisieren" : "Verbinden"}
            </button>
            {editing && (
              <button
                onClick={() => {
                  setEditing(false);
                  setApiKey("");
                  setMsg(null);
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-800"
              >
                Abbrechen
              </button>
            )}
          </div>
        </div>
      )}
      {msg && (
        <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>
      )}
    </Card>
  );
}
