"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Card";
import { Sparkline } from "@/components/charts/Charts";
import type { BodySummary } from "@/domain/training/body";

export function BodyMetrics({
  summary,
  heightCm,
}: {
  summary: BodySummary;
  heightCm: number | null;
}) {
  const bmi =
    summary.latestWeight != null && heightCm
      ? Math.round((summary.latestWeight / (heightCm / 100) ** 2) * 10) / 10
      : null;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    weightKg: summary.latestWeight ?? 75,
    restingHr: summary.latestRestingHr ?? 50,
  });

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weightKg: form.weightKg,
          restingHr: form.restingHr,
        }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const change = summary.weightChange;

  return (
    <Card
      title="Körpermetriken"
      subtitle="Gewicht & Ruhepuls im Verlauf"
      actions={
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
        >
          {open ? "Schließen" : "Eintragen"}
        </button>
      }
    >
      {open ? (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <label className="text-xs text-neutral-500">
            Gewicht (kg)
            <input
              type="number"
              step={0.1}
              value={form.weightKg}
              onChange={(e) => setForm({ ...form, weightKg: Number(e.target.value) || 0 })}
              className="mt-1 block w-24 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Ruhepuls (bpm)
            <input
              type="number"
              value={form.restingHr}
              onChange={(e) => setForm({ ...form, restingHr: Number(e.target.value) || 0 })}
              className="mt-1 block w-24 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {saving ? "…" : "Speichern"}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-wide text-neutral-400">
              Gewicht
            </span>
            {change != null ? (
              <span
                className={`text-xs font-medium ${
                  change < 0 ? "text-emerald-600" : change > 0 ? "text-amber-600" : "text-neutral-400"
                }`}
              >
                {change > 0 ? "+" : ""}
                {change} kg
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-2xl font-semibold text-neutral-900">
            {summary.latestWeight != null ? `${summary.latestWeight} kg` : "—"}
            {bmi != null ? (
              <span className="ml-2 text-xs font-normal text-neutral-400">
                BMI {bmi}
              </span>
            ) : null}
          </p>
          <div className="mt-1 text-blue-500">
            <Sparkline values={summary.weights} color="#0a84ff" height={32} />
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <span className="text-[11px] uppercase tracking-wide text-neutral-400">
            Ruhepuls
          </span>
          <p className="mt-0.5 text-2xl font-semibold text-neutral-900">
            {summary.latestRestingHr != null ? `${summary.latestRestingHr} bpm` : "—"}
          </p>
          <div className="mt-1 text-rose-400">
            <Sparkline values={summary.restingHrs} color="#ff3b30" height={32} />
          </div>
        </div>
      </div>
    </Card>
  );
}
