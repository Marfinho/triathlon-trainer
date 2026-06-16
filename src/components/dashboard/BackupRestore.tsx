"use client";

import { useRef, useState } from "react";
import { Card } from "./Card";

type BackupArrayKey =
  | "raceEvents"
  | "plannedWorkouts"
  | "actualActivities"
  | "gearItems"
  | "trainingGoals"
  | "bodyMetrics"
  | "journalEntries"
  | "readinessSnapshots"
  | "painSnapshots";

const BACKUP_ARRAY_KEYS: BackupArrayKey[] = [
  "raceEvents",
  "plannedWorkouts",
  "actualActivities",
  "gearItems",
  "trainingGoals",
  "bodyMetrics",
  "journalEntries",
  "readinessSnapshots",
  "painSnapshots",
];

const ARRAY_LABELS: Record<BackupArrayKey, string> = {
  raceEvents: "Wettkämpfe",
  plannedWorkouts: "Geplante Einheiten",
  actualActivities: "Absolvierte Aktivitäten",
  gearItems: "Ausrüstung",
  trainingGoals: "Trainingsziele",
  bodyMetrics: "Körperwerte",
  journalEntries: "Journaleinträge",
  readinessSnapshots: "Readiness-Snapshots",
  painSnapshots: "Schmerz-Snapshots",
};

interface ParsedBackup {
  version: string;
  counts: Record<BackupArrayKey, number>;
}

interface RestoreResult {
  restored?: Record<string, number>;
  skipped?: Record<string, number> | number;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function BackupRestore({
  cooldownActive,
  nextBackupAt,
}: {
  cooldownActive: boolean;
  nextBackupAt: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const versionValid = parsed?.version === "2";
  const canRestore = file !== null && parsed !== null && versionValid;

  function resetSelection() {
    setFile(null);
    setParsed(null);
    setParseError(null);
    setConfirmOpen(false);
    setResult(null);
    setRestoreError(null);
  }

  async function handleFile(selected: File) {
    resetSelection();
    setFile(selected);
    try {
      const text = await selected.text();
      const json = JSON.parse(text) as unknown;
      if (!isRecord(json)) {
        throw new Error("invalid-root");
      }
      const version = typeof json.version === "string" ? json.version : "";
      const data = isRecord(json.data) ? json.data : {};
      const counts = BACKUP_ARRAY_KEYS.reduce((acc, key) => {
        const arr = data[key];
        acc[key] = Array.isArray(arr) ? arr.length : 0;
        return acc;
      }, {} as Record<BackupArrayKey, number>);
      setParsed({ version, counts });
    } catch {
      setFile(null);
      setParsed(null);
      setParseError("Datei konnte nicht gelesen werden — ungültiges JSON.");
    }
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected) {
      void handleFile(selected);
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const selected = event.dataTransfer.files?.[0];
    if (selected) {
      void handleFile(selected);
    }
  }

  async function onConfirmRestore() {
    if (!file) return;
    setSubmitting(true);
    setRestoreError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("backup-json", file);
      const response = await fetch("/api/backup/restore", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as RestoreResult;
      if (!response.ok) {
        const message =
          typeof payload.error === "string"
            ? payload.error
            : "Wiederherstellung fehlgeschlagen.";
        setRestoreError(message);
        return;
      }
      setResult(payload);
      setConfirmOpen(false);
      location.reload();
    } catch {
      setRestoreError("Wiederherstellung fehlgeschlagen — Netzwerkfehler.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      title="Backup & Wiederherstellung"
      subtitle="Sichere deine Daten oder spiele ein Backup wieder ein."
    >
      <div className="flex flex-col gap-8">
        {/* (a) Backup */}
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-neutral-900">
            Backup
          </h3>
          {cooldownActive ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled
                className="inline-flex w-fit cursor-not-allowed items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-400"
              >
                Vollständiges Backup (JSON)
              </button>
              <p className="text-xs" style={{ color: "#F0A500" }}>
                Nächstes Backup ab {formatDateTime(nextBackupAt)} · Upgrade auf
                Pro für sofortige Backups
              </p>
            </div>
          ) : (
            <a
              href="/api/backup/export"
              className="inline-flex w-fit items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-neutral-50"
            >
              Vollständiges Backup (JSON)
            </a>
          )}
        </div>

        {/* (b) Restore */}
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-neutral-900">
            Wiederherstellung
          </h3>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
              isDragging
                ? "border-neutral-400 bg-neutral-50"
                : "border-neutral-200 bg-white"
            }`}
          >
            <p className="text-sm text-neutral-700">
              Backup-Datei (.json) hierher ziehen
            </p>
            <p className="text-xs text-neutral-500">oder</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
            >
              Datei auswählen
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={onInputChange}
              className="hidden"
            />
            {file ? (
              <p className="mt-1 text-xs text-neutral-500">
                Ausgewählt: {file.name}
              </p>
            ) : null}
          </div>

          {parseError ? (
            <p className="mt-3 text-xs text-red-600">{parseError}</p>
          ) : null}

          {parsed ? (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-700">
                  Vorschau
                </span>
                <span className="text-xs text-neutral-500">
                  Version: {parsed.version || "—"}
                </span>
              </div>
              {versionValid ? null : (
                <p className="mb-2 text-xs" style={{ color: "#F0A500" }}>
                  Ungültiges Format — Version 2 erforderlich
                </p>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {BACKUP_ARRAY_KEYS.map((key) => (
                  <div key={key} className="flex justify-between gap-2">
                    <dt className="text-xs text-neutral-500">
                      {ARRAY_LABELS[key]}
                    </dt>
                    <dd className="text-xs font-medium text-neutral-900">
                      {parsed.counts[key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="mt-4">
            <button
              type="button"
              disabled={!canRestore || submitting}
              onClick={() => {
                setRestoreError(null);
                setConfirmOpen(true);
              }}
              className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                canRestore && !submitting
                  ? "border border-neutral-200 bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50"
                  : "cursor-not-allowed border border-neutral-200 bg-neutral-100 text-neutral-400"
              }`}
            >
              Wiederherstellen
            </button>
          </div>

          {confirmOpen ? (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-sm text-neutral-700">
                Bestehende Daten werden mit dem Backup überschrieben. Completed
                Aktivitäten bleiben erhalten.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void onConfirmRestore()}
                  className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Wird wiederhergestellt…" : "Ja, wiederherstellen"}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmOpen(false)}
                  className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : null}

          {restoreError ? (
            <p className="mt-3 text-xs text-red-600">{restoreError}</p>
          ) : null}

          {result ? (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
              <p className="mb-2 text-xs font-medium text-neutral-700">
                Wiederherstellung abgeschlossen
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-neutral-600">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
