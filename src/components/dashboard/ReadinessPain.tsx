"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Card";
import { Sparkline } from "@/components/charts/Charts";

export interface ReadinessData {
  date: string;
  status: string | null;
  sleepTrend: string | null;
  hrvTrend: string | null;
  restingHrTrend: string | null;
  subjectiveFatigue: number | null;
  notes: string | null;
}

export interface PainData {
  date: string;
  overall: number | null;
  knee: number | null;
  achilles: number | null;
  calf: number | null;
  back: number | null;
  notes: string | null;
}

const READINESS_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
};

function painColor(v: number | null): string {
  if (v == null) return "#d2d2d7";
  if (v <= 1) return "#34c759";
  if (v <= 3) return "#ff9f0a";
  return "#ff3b30";
}

export function ReadinessPain({
  readiness,
  pain,
  fatigueTrend,
  painTrend,
  computedHrvTrend,
  computedRestingHrTrend,
}: {
  readiness: ReadinessData | null;
  pain: PainData | null;
  fatigueTrend: (number | null)[];
  painTrend: (number | null)[];
  /** Aus den HRV-Körpermetriken berechnete Tendenz (überschreibt die manuelle Angabe). */
  computedHrvTrend?: string | null;
  /** Aus den Ruhepuls-Körpermetriken berechnete Tendenz (überschreibt die manuelle Angabe). */
  computedRestingHrTrend?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    status: "green",
    subjectiveFatigue: 3,
    sleepTrend: "",
    overall: 1,
    achilles: 0,
    knee: 0,
    calf: 0,
    back: 0,
    notes: "",
  });

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readiness: {
            status: f.status,
            subjectiveFatigue: f.subjectiveFatigue,
            sleepTrend: f.sleepTrend || undefined,
            notes: f.notes || undefined,
          },
          pain: {
            overall: f.overall,
            achilles: f.achilles,
            knee: f.knee,
            calf: f.calf,
            back: f.back,
          },
        }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const hrvTrend = computedHrvTrend ?? readiness?.hrvTrend ?? null;
  const restingHrTrend = computedRestingHrTrend ?? readiness?.restingHrTrend ?? null;

  return (
    <Card
      title="Readiness & Schmerz"
      subtitle="Tages-Check-in mit Verlauf"
      actions={
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
        >
          {open ? "Schließen" : "Check-in"}
        </button>
      }
    >
      {open ? (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-3">
          <label className="text-xs text-neutral-500">
            Readiness
            <select
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="green">grün</option>
              <option value="amber">gelb</option>
              <option value="red">rot</option>
            </select>
          </label>
          <RangeField
            label={`Müdigkeit (${f.subjectiveFatigue})`}
            value={f.subjectiveFatigue}
            onChange={(v) => setF({ ...f, subjectiveFatigue: v })}
          />
          <label className="text-xs text-neutral-500">
            Schlaf
            <select
              value={f.sleepTrend}
              onChange={(e) => setF({ ...f, sleepTrend: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">— keine Angabe —</option>
              <option value="besser">besser</option>
              <option value="gleich">gleich</option>
              <option value="schlechter">schlechter</option>
            </select>
          </label>
          <RangeField
            label={`Schmerz gesamt (${f.overall})`}
            value={f.overall}
            onChange={(v) => setF({ ...f, overall: v })}
          />
          <RangeField
            label={`Achilles (${f.achilles})`}
            value={f.achilles}
            onChange={(v) => setF({ ...f, achilles: v })}
          />
          <RangeField
            label={`Knie (${f.knee})`}
            value={f.knee}
            onChange={(v) => setF({ ...f, knee: v })}
          />
          <RangeField
            label={`Wade (${f.calf})`}
            value={f.calf}
            onChange={(v) => setF({ ...f, calf: v })}
          />
          <RangeField
            label={`Rücken (${f.back})`}
            value={f.back}
            onChange={(v) => setF({ ...f, back: v })}
          />
          <label className="col-span-2 text-xs text-neutral-500 sm:col-span-3">
            Notizen
            <textarea
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
              rows={2}
              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {saving ? "Speichere…" : "Speichern"}
            </button>
          </div>
        </div>
      ) : null}

      {!readiness && !pain ? (
        <p className="text-sm text-neutral-400">
          Noch kein Check-in erfasst. Lege über den Button deinen ersten an.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Readiness
              {readiness?.status ? (
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    READINESS_DOT[readiness.status] ?? "bg-neutral-300"
                  }`}
                />
              ) : null}
            </h3>
            {readiness || hrvTrend || restingHrTrend ? (
              <dl className="space-y-1.5 text-sm">
                <Row label="Status" value={readiness?.status ?? "—"} />
                <Row label="Schlaf" value={readiness?.sleepTrend ?? "—"} />
                <Row
                  label="HRV"
                  value={hrvTrend ?? "—"}
                  auto={computedHrvTrend != null}
                />
                <Row
                  label="Ruhepuls"
                  value={restingHrTrend ?? "—"}
                  auto={computedRestingHrTrend != null}
                />
                <Row
                  label="Subj. Müdigkeit"
                  value={String(readiness?.subjectiveFatigue ?? "—")}
                />
              </dl>
            ) : null}
            {readiness?.notes ? (
              <p className="mt-2 text-xs italic text-neutral-500">{readiness.notes}</p>
            ) : null}
            <div className="mt-2 text-blue-500">
              <p className="mb-0.5 text-[11px] text-neutral-400">Müdigkeit (Verlauf)</p>
              <Sparkline values={fatigueTrend} color="#0a84ff" height={32} />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Schmerzstatus
            </h3>
            {pain ? (
              <div className="space-y-1.5">
                {[
                  ["Gesamt", pain.overall],
                  ["Knie", pain.knee],
                  ["Achilles", pain.achilles],
                  ["Wade", pain.calf],
                  ["Rücken", pain.back],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex items-center gap-2">
                    <span className="w-20 text-sm text-neutral-500">{label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${((val as number) ?? 0) * 10}%`,
                          backgroundColor: painColor(val as number | null),
                        }}
                      />
                    </div>
                    <span className="w-6 text-right text-sm text-neutral-700">
                      {val ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-2">
              <p className="mb-0.5 text-[11px] text-neutral-400">Schmerz gesamt (Verlauf)</p>
              <Sparkline values={painTrend} color="#ff3b30" height={32} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Row({
  label,
  value,
  auto,
}: {
  label: string;
  value: string;
  auto?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-800">
        {value}
        {auto ? (
          <span
            title="Automatisch aus den Körpermetriken berechnet"
            className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-normal text-blue-500"
          >
            auto
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function RangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="text-xs text-neutral-500">
      {label}
      <input
        type="range"
        min={0}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 block w-full accent-blue-600"
      />
    </label>
  );
}
