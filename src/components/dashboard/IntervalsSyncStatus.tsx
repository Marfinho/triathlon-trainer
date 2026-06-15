"use client";

import { useState } from "react";
import { Card } from "./Card";

interface SyncState {
  configured: boolean;
  queue: { pending: number; processing: number; failed: number; success: number };
  syncedWorkouts: number;
}

export function IntervalsSyncStatus({ initial }: { initial: SyncState }) {
  const [state, setState] = useState<SyncState>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/intervals-sync");
    if (res.ok) setState(await res.json());
  }

  async function runSync() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/intervals-sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setMessage(data.error ?? "Sync fehlgeschlagen.");
      } else {
        setMessage(
          `Verarbeitet: ${data.processed}, erfolgreich: ${data.succeeded}, fehlgeschlagen: ${data.failed}.`,
        );
        await refresh();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unbekannter Fehler.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Intervals.icu Sync"
      subtitle="Geplante Workouts -> Intervals.icu (idempotent)"
      actions={
        <button
          onClick={runSync}
          disabled={busy || !state.configured}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Synchronisiere…" : "Jetzt synchronisieren"}
        </button>
      }
    >
      {!state.configured ? (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Intervals.icu ist nicht konfiguriert. Setze INTERVALS_ATHLETE_ID und
          INTERVALS_API_KEY in <code>.env</code>.
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <Stat label="Pending" value={state.queue.pending} />
        <Stat label="Processing" value={state.queue.processing} />
        <Stat label="Erfolgreich" value={state.queue.success} />
        <Stat label="Fehlgeschlagen" value={state.queue.failed} tone="error" />
        <Stat label="Verknüpft" value={state.syncedWorkouts} tone="ok" />
      </dl>

      {message ? (
        <p className="mt-3 text-xs text-neutral-500">{message}</p>
      ) : null}
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "error";
}) {
  const color =
    tone === "error"
      ? value > 0
        ? "text-rose-600"
        : "text-neutral-800"
      : tone === "ok"
        ? "text-emerald-600"
        : "text-neutral-800";
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-neutral-400">
        {label}
      </dt>
      <dd className={`mt-0.5 text-lg font-semibold ${color}`}>{value}</dd>
    </div>
  );
}
