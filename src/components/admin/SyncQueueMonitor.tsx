"use client";

import { useEffect, useState } from "react";

interface SyncJob {
  id: string;
  userId: string;
  localWorkoutId: string;
  action: string;
  status: string;
  attempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface ApiResponse {
  jobs: SyncJob[];
  counts: Record<string, number>;
}

export function SyncQueueMonitor() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000); // auto-refresh jede 5 Sekunden
    return () => clearInterval(interval);
  }, []);

  async function loadJobs() {
    setLoading(true);
    try {
      const url = new URL("/api/admin/sync-queue", window.location.origin);
      if (filter !== "all") url.searchParams.set("status", filter);
      const res = await fetch(url);
      const data: ApiResponse = await res.json();
      setJobs(data.jobs);
      setCounts(data.counts);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(jobId: string, action: "retry" | "cancel") {
    setActioning(jobId);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/sync-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({
          ok: true,
          text: action === "retry" ? "Job zur Wiederholung eingeplant." : "Job storniert.",
        });
        await loadJobs();
      } else {
        setMsg({ ok: false, text: data.error ?? "Fehler." });
      }
    } finally {
      setActioning(null);
    }
  }

  const displayJobs = filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900">Sync-Queue überwachen</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "pending", "processing", "success", "failed"].map((status) => (
          <button
            key={status}
            onClick={() => {
              setFilter(status);
              setMsg(null);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === status
                ? "bg-blue-600 text-white"
                : "border border-neutral-200 text-neutral-600 hover:border-neutral-300"
            }`}
          >
            {status === "all"
              ? `Alle (${jobs.length})`
              : `${status} (${counts[status] ?? 0})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Laden…</p>
      ) : displayJobs.length === 0 ? (
        <p className="text-sm text-neutral-500">Keine Jobs gefunden.</p>
      ) : (
        <div className="space-y-3">
          {displayJobs.map((job) => (
            <div
              key={job.id}
              className="rounded-lg border border-neutral-100 bg-neutral-50 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <code className="text-[11px] text-neutral-500">{job.id.slice(0, 8)}</code>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      job.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : job.status === "processing"
                          ? "bg-blue-100 text-blue-800"
                          : job.status === "success"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
                <span className="text-[11px] text-neutral-500">
                  {new Date(job.createdAt).toLocaleString("de-DE")}
                </span>
              </div>
              <div className="mb-2 text-xs text-neutral-700">
                <p>
                  <strong>Action:</strong> {job.action}
                </p>
                <p>
                  <strong>Versuche:</strong> {job.attempts}
                </p>
                {job.nextAttemptAt && (
                  <p>
                    <strong>Nächster Versuch:</strong>{" "}
                    {new Date(job.nextAttemptAt).toLocaleString("de-DE")}
                  </p>
                )}
                {job.errorMessage && (
                  <p className="mt-1 text-red-600">
                    <strong>Fehler:</strong> {job.errorMessage}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {job.status !== "success" && (
                  <button
                    onClick={() => handleAction(job.id, "retry")}
                    disabled={actioning === job.id}
                    className="text-[11px] text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    Wiederholen
                  </button>
                )}
                <button
                  onClick={() => handleAction(job.id, "cancel")}
                  disabled={actioning === job.id}
                  className="text-[11px] text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Stornieren
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {msg && (
        <p className={`mt-4 text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
