"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/dashboard/Card";
import type { UpdateView } from "@/lib/system-update";

const btn =
  "rounded-lg px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

export function SystemUpdate() {
  const [view, setView] = useState<UpdateView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const wasRunning = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/update", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data: UpdateView = await res.json();
      setView(data);
      setReconnecting(false);
      // Nach erfolgreichem Neustart die Seite neu laden, damit die neue Version läuft.
      if (wasRunning.current && data.status?.state === "success") {
        wasRunning.current = false;
        window.location.reload();
      }
      wasRunning.current = data.status?.state === "running";
    } catch {
      // Während des Neustarts ist die App kurz nicht erreichbar.
      if (wasRunning.current) setReconnecting(true);
    }
  }, []);

  const state = view?.status?.state;
  const busy = state === "running" || state === "checking";

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!busy && !reconnecting) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [busy, reconnecting, load]);

  async function trigger(action: "check" | "update") {
    if (
      action === "update" &&
      !window.confirm("Update jetzt einspielen? Die App wird neu gebaut und ist dabei kurz nicht erreichbar.")
    ) {
      return;
    }
    setError(null);
    const res = await fetch("/api/admin/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Fehlgeschlagen.");
      return;
    }
    wasRunning.current = action === "update";
    setTimeout(load, 1500);
  }

  const s = view?.status;
  return (
    <Card title="System-Update" subtitle="Zieht den neuesten Stand aus GitHub und startet die App neu.">
      {view && !view.available ? (
        <p className="text-sm text-amber-700">
          Kein Updater-Dienst angebunden – nur im Docker-Compose-Betrieb verfügbar.
        </p>
      ) : (
        <div className="space-y-3">
          {s ? (
            <div className="text-sm text-neutral-700">
              <p>
                Installiert: <code className="font-mono">{s.current || "?"}</code>
                {s.behind > 0 ? (
                  <>
                    {" · "}
                    <span className="font-semibold text-blue-700">
                      {s.behind} neue{s.behind === 1 ? "r Commit" : " Commits"} verfügbar
                    </span>{" "}
                    (<code className="font-mono">{s.latest}</code>: {s.latestSubject})
                  </>
                ) : (
                  <span className="text-emerald-600"> · aktuell</span>
                )}
              </p>
              <p
                className={`mt-1 text-xs ${
                  s.state === "error" ? "text-red-600" : s.state === "success" ? "text-emerald-600" : "text-neutral-500"
                }`}
              >
                {reconnecting ? "App startet neu – warte auf Verbindung…" : s.message}
              </p>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Updater startet…</p>
          )}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !s}
              onClick={() => trigger("check")}
              className={`${btn} border border-neutral-300 bg-white text-neutral-800`}
            >
              Auf Updates prüfen
            </button>
            <button
              type="button"
              disabled={busy || !s || s.behind === 0}
              onClick={() => trigger("update")}
              className={`${btn} bg-blue-600 text-white`}
            >
              {state === "running" ? "Aktualisiere…" : "Jetzt aktualisieren"}
            </button>
          </div>
          {view?.log ? (
            <pre className="max-h-48 overflow-auto rounded-lg bg-neutral-900 p-3 text-[11px] leading-snug text-neutral-200">
              {view.log}
            </pre>
          ) : null}
        </div>
      )}
    </Card>
  );
}
