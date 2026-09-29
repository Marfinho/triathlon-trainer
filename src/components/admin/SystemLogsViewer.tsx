"use client";

import { useEffect, useState } from "react";

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  ip: string | null;
  meta: unknown;
  createdAt: string;
}

interface SyncLog {
  id: string;
  userId: string;
  localWorkoutId: string | null;
  action: string | null;
  type: string | null;
  status: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  reason: string | null;
  createdAt: string;
}

type Log = AuditLog | SyncLog;

interface ApiResponse {
  logs: Log[];
  total: number;
  type: string;
  limit: number;
  offset: number;
}

export function SystemLogsViewer() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logType, setLogType] = useState<"sync" | "audit">("sync");
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    loadLogs();
  }, [logType, offset]);

  async function loadLogs() {
    setLoading(true);
    try {
      const url = new URL("/api/admin/logs", window.location.origin);
      url.searchParams.set("type", logType);
      url.searchParams.set("limit", limit.toString());
      url.searchParams.set("offset", offset.toString());
      const res = await fetch(url);
      const data: ApiResponse = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const isSyncLog = (log: Log): log is SyncLog => "type" in log;

  return (
    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">System-Logs</h2>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => {
            setLogType("sync");
            setOffset(0);
          }}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
            logType === "sync"
              ? "bg-blue-600 text-white"
              : "border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700"
          }`}
        >
          Sync-Logs
        </button>
        <button
          onClick={() => {
            setLogType("audit");
            setOffset(0);
          }}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
            logType === "audit"
              ? "bg-blue-600 text-white"
              : "border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700"
          }`}
        >
          Audit-Logs
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Laden…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Keine Logs gefunden.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/60 p-3 text-xs"
            >
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <code className="text-[10px] text-neutral-400">
                    {new Date(log.createdAt).toLocaleString("de-DE")}
                  </code>
                  {isSyncLog(log) ? (
                    <>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          log.status === "pending"
                            ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200"
                            : log.status === "success"
                              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200"
                              : "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200"
                        }`}
                      >
                        {log.status}
                      </span>
                      {log.durationMs && (
                        <span className="text-neutral-500 dark:text-neutral-400">({log.durationMs}ms)</span>
                      )}
                    </>
                  ) : (
                    <span className="text-neutral-600 dark:text-neutral-400">{log.action}</span>
                  )}
                </div>
              </div>
              <div className="text-neutral-700 dark:text-neutral-300">
                {isSyncLog(log) ? (
                  <>
                    <p>
                      <strong>Typ:</strong> {log.type || "—"}
                    </p>
                    {log.action && <p><strong>Action:</strong> {log.action}</p>}
                    {log.reason && (
                      <p>
                        <strong>Grund:</strong> {log.reason}
                      </p>
                    )}
                    {log.errorMessage && (
                      <p className="mt-1 text-red-600 dark:text-red-400">
                        <strong>Fehler:</strong> {log.errorMessage}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      <strong>User:</strong> {log.userId || "—"}
                    </p>
                    {log.ip && <p><strong>IP:</strong> {log.ip}</p>}
                    {log.meta && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400">Meta-Daten</summary>
                        <pre className="mt-1 overflow-auto rounded bg-neutral-100 dark:bg-neutral-800 p-2 text-[10px]">
                          {JSON.stringify(log.meta, null, 2)}
                        </pre>
                      </details>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {total} Logs · Seite {currentPage} von {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 disabled:opacity-30"
          >
            ← Zurück
          </button>
          <button
            onClick={() => setOffset(Math.min(total - limit, offset + limit))}
            disabled={offset + limit >= total}
            className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 disabled:opacity-30"
          >
            Weiter →
          </button>
        </div>
      </div>
    </div>
  );
}
