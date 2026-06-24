"use client";

import { useState } from "react";
import { Sparkline } from "@/components/charts/Charts";
import { useToast } from "@/components/ui/Toast";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./WidgetStates";

const READINESS_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
};

const STATUS_OPTION_LABEL: Record<string, string> = {
  green: "grün",
  amber: "gelb",
  red: "rot",
};

export function ReadinessCheckin({ size }: { size: WidgetSize }) {
  const { data, loading, error, refetch } = useDashboardData();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("green");
  const [fatigue, setFatigue] = useState(3);
  const [sleepTrend, setSleepTrend] = useState("");

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const { latest, history } = data.readiness;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readiness: {
            status,
            subjectiveFatigue: fatigue,
            sleepTrend: sleepTrend || undefined,
          },
        }),
      });
      if (!res.ok) throw new Error("Speichern fehlgeschlagen");
      toast("Check-in gespeichert.", "success");
      setOpen(false);
      refetch();
    } catch {
      toast("Check-in konnte nicht gespeichert werden.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (size === "S") {
    if (!latest) return <WidgetEmpty message="Noch kein Check-in." />;
    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            READINESS_DOT[latest.status ?? ""] ?? "bg-neutral-300"
          }`}
        />
        <p className="text-sm text-neutral-700">
          Müdigkeit {latest.subjectiveFatigue ?? "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!latest ? (
        <WidgetEmpty message="Noch kein Check-in erfasst." />
      ) : (
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-500">Status</dt>
            <dd className="flex items-center gap-1.5 font-medium text-neutral-800">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  READINESS_DOT[latest.status ?? ""] ?? "bg-neutral-300"
                }`}
              />
              {latest.status ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Schlaf</dt>
            <dd className="font-medium text-neutral-800">{latest.sleepTrend ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">HRV</dt>
            <dd className="font-medium text-neutral-800">{latest.hrvTrend ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Müdigkeit</dt>
            <dd className="font-medium text-neutral-800">
              {latest.subjectiveFatigue ?? "—"}
            </dd>
          </div>
        </dl>
      )}

      {size === "L" && (
        <div className="text-blue-500">
          <p className="mb-0.5 text-[11px] text-neutral-400">Müdigkeit (Verlauf)</p>
          <Sparkline
            values={history
              .slice()
              .reverse()
              .map((h) => h.subjectiveFatigue)}
            color="#0a84ff"
            height={32}
          />
        </div>
      )}

      {size === "L" && (
        <div>
          {open ? (
            <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <label className="block text-xs text-neutral-500">
                Readiness
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 block h-11 w-full rounded-lg border border-neutral-300 bg-white px-2 text-sm"
                >
                  {Object.entries(STATUS_OPTION_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-neutral-500">
                Müdigkeit ({fatigue})
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={fatigue}
                  onChange={(e) => setFatigue(Number(e.target.value))}
                  className="mt-2 block w-full accent-blue-600"
                />
              </label>
              <label className="block text-xs text-neutral-500">
                Schlaf
                <select
                  value={sleepTrend}
                  onChange={(e) => setSleepTrend(e.target.value)}
                  className="mt-1 block h-11 w-full rounded-lg border border-neutral-300 bg-white px-2 text-sm"
                >
                  <option value="">— keine Angabe —</option>
                  <option value="besser">besser</option>
                  <option value="gleich">gleich</option>
                  <option value="schlechter">schlechter</option>
                </select>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-11 flex-1 items-center justify-center rounded-full border border-neutral-200 bg-white text-sm font-medium text-neutral-600"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="flex h-11 flex-1 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-11 items-center justify-center rounded-full border border-neutral-200 px-4 text-sm font-medium text-neutral-600"
            >
              Check-in
            </button>
          )}
        </div>
      )}
    </div>
  );
}
