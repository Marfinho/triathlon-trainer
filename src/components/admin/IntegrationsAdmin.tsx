"use client";

import { useState } from "react";
import { Card } from "@/components/dashboard/Card";

export interface IntegrationView {
  provider: string;
  label: string;
  kind: "oauth" | "apikey";
  description: string;
  enabled: boolean;
  clientId: string;
  hasSecret: boolean;
  usesEnvFallback: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export function IntegrationsAdmin({ initial }: { initial: IntegrationView[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {initial.map((it) => (
        <IntegrationCard key={it.provider} initial={it} />
      ))}
    </div>
  );
}

function IntegrationCard({ initial }: { initial: IntegrationView }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [clientId, setClientId] = useState(initial.clientId);
  const [clientSecret, setClientSecret] = useState("");
  const [hasSecret, setHasSecret] = useState(initial.hasSecret);
  const [usesEnvFallback, setUsesEnvFallback] = useState(initial.usesEnvFallback);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const isOAuth = initial.kind === "oauth";
  const isOllama = initial.provider === "ollama";

  async function save(clearSecret = false) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: initial.provider,
          enabled,
          clientId: isOAuth || isOllama ? clientId : undefined,
          clientSecret: (isOAuth || isOllama) && clientSecret ? clientSecret : undefined,
          clearSecret: clearSecret || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.integration) {
        setHasSecret(data.integration.hasSecret);
        setUsesEnvFallback(data.integration.usesEnvFallback);
        setClientId(data.integration.clientId);
        setClientSecret("");
        setMsg({ ok: true, text: "Gespeichert." });
      } else {
        setMsg({ ok: false, text: data.error ?? "Speichern fehlgeschlagen." });
      }
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestMsg(null);
    setOllamaModels([]);
    setLoadingModels(true);
    try {
      const res = await fetch("/api/integrations/ollama/test", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setOllamaModels(data.models ?? []);
        setTestMsg({
          ok: true,
          text: `✓ Verbunden. ${data.models?.length ?? 0} Modell(e) verfügbar.`,
        });
      } else {
        setTestMsg({
          ok: false,
          text: data.error ?? "Verbindungsfehler.",
        });
      }
    } catch (error) {
      setTestMsg({ ok: false, text: "Netzwerkfehler." });
    } finally {
      setTesting(false);
      setLoadingModels(false);
    }
  }

  const configIncomplete =
    (isOAuth && enabled && (!clientId || !hasSecret)) ||
    (isOllama && enabled && (!clientId || !hasSecret));

  return (
    <Card title={initial.label} subtitle={initial.description}>
      <div className="space-y-4">
        <label className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition ${
              enabled ? "bg-emerald-600" : "bg-neutral-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                enabled ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
          <span className="text-sm font-medium text-neutral-900">
            {enabled ? "Aktiviert" : "Deaktiviert"}
          </span>
        </label>

        {isOAuth ? (
          <div className="space-y-3">
            <label className="block text-xs text-neutral-500">
              Client-ID
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="z.B. 12345"
                className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs text-neutral-500">
              Client-Secret
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={hasSecret ? "•••••••• (gesetzt – leer lassen zum Behalten)" : "Secret eingeben"}
                className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
              <span>{hasSecret ? "Secret gespeichert ✓" : "Kein Secret gesetzt"}</span>
              {usesEnvFallback && <span className="text-amber-600">aus Env-Variable</span>}
              {hasSecret && (
                <button
                  type="button"
                  onClick={() => save(true)}
                  disabled={saving}
                  className="text-red-500 hover:text-red-600 disabled:opacity-40"
                >
                  Secret entfernen
                </button>
              )}
            </div>
          </div>
        ) : isOllama ? (
          <div className="space-y-3">
            <label className="block text-xs text-neutral-500">
              Basis-URL
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="z.B. http://localhost:11434"
                className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs text-neutral-500">
              Standard-Modell
              <input
                type="text"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={hasSecret ? "•••••••• (gesetzt – leer lassen zum Behalten)" : "z.B. llama2, mistral"}
                className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
              <span>{hasSecret ? "Modell gespeichert ✓" : "Kein Modell gesetzt"}</span>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
            Keine globalen Zugangsdaten nötig. Nutzer hinterlegen ihren eigenen
            API-Key im Profil, sobald die Integration aktiviert ist.
          </p>
        )}

        {configIncomplete && (
          <p className="text-xs text-amber-700">
            Aktiviert, aber Konfiguration unvollständig – bitte Basis-URL{isOAuth && "/Client-ID"} und {isOAuth ? "Client-Secret" : "Modell"} setzen.
          </p>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
            >
              {saving ? "…" : "Speichern"}
            </button>
            {msg && (
              <span className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>
                {msg.text}
              </span>
            )}
          </div>
          {isOllama && enabled && clientId && hasSecret && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => testConnection()}
                  disabled={testing}
                  className="rounded-lg bg-neutral-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-neutral-500 disabled:opacity-40"
                >
                  {testing ? "…" : "Verbindung testen"}
                </button>
                {testMsg && (
                  <span className={`text-xs ${testMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                    {testMsg.text}
                  </span>
                )}
              </div>
              {ollamaModels.length > 0 && (
                <label className="block text-xs text-neutral-500">
                  Verfügbare Modelle
                  <select
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    disabled={loadingModels}
                    className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-neutral-100"
                  >
                    <option value="">Modell wählen…</option>
                    {ollamaModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
