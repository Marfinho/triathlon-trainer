"use client";

import { useEffect, useState } from "react";
import type { WidgetSize } from "../types";
import { WidgetError, WidgetSkeleton } from "./WidgetStates";

interface SyncLogEntry {
  action: string;
  success: boolean;
  reason: string | null;
  at: string;
}

interface SyncState {
  configured: boolean;
  queue: { pending: number; processing: number; failed: number; success: number };
  syncedWorkouts: number;
  recentLogs?: SyncLogEntry[];
}

export function IntervalsSyncStatus({ size }: { size: WidgetSize }) {
  const [state, setState] = useState<SyncState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/intervals-sync")
      .then((res) => {
        if (!res.ok) throw new Error("Sync-Status konnte nicht geladen werden.");
        return res.json();
      })
      .then((json: SyncState) => setState(json))
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler"));
  }, []);

  if (error) return <WidgetError message={error} />;
  if (!state) return <WidgetSkeleton />;

  if (!state.configured) {
    return <p className="text-sm text-neutral-400">Nicht konfiguriert.</p>;
  }

  if (size === "S") {
    return (
      <p className="text-sm text-neutral-700">
        {state.syncedWorkouts} synchronisiert
        {state.queue.failed > 0 ? (
          <span className="text-rose-600"> · {state.queue.failed} fehlgeschlagen</span>
        ) : null}
      </p>
    );
  }

  const stats: { label: string; value: number; tone?: "ok" | "error" }[] = [
    { label: "Pending", value: state.queue.pending },
    { label: "Processing", value: state.queue.processing },
    { label: "Erfolgreich", value: state.queue.success },
    { label: "Fehlgeschlagen", value: state.queue.failed, tone: "error" },
    { label: "Verknüpft", value: state.syncedWorkouts, tone: "ok" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label}>
            <p
              className={`text-base font-semibold ${
                s.tone === "error"
                  ? s.value > 0
                    ? "text-rose-600"
                    : "text-neutral-900"
                  : s.tone === "ok"
                    ? "text-emerald-600"
                    : "text-neutral-900"
              }`}
            >
              {s.value}
            </p>
            <p className="text-neutral-400">{s.label}</p>
          </div>
        ))}
      </div>
      {size === "L" && state.recentLogs && state.recentLogs.length > 0 && (
        <div className="space-y-1 border-t border-neutral-100 pt-2">
          {state.recentLogs.map((l, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-neutral-600">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    l.success ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
                {l.action}
                {l.reason ? ` · ${l.reason}` : ""}
              </span>
              <span className="text-neutral-400">
                {new Date(l.at).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
