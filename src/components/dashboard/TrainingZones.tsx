"use client";

import { useMemo, useState } from "react";
import { Card } from "./Card";
import {
  computePowerZones,
  computeHrZones,
  computePaceZones,
  formatPace,
  type Zone,
} from "@/domain/training/zones";

type Tab = "power" | "hr" | "pace";

export function TrainingZones({
  ftp,
  thresholdHr,
  thresholdPaceSecPerKm,
}: {
  ftp: number | null;
  thresholdHr: number | null;
  thresholdPaceSecPerKm: number | null;
}) {
  const [tab, setTab] = useState<Tab>("power");
  const [values, setValues] = useState({
    ftp: ftp ?? 240,
    thresholdHr: thresholdHr ?? 168,
    thresholdPaceSecPerKm: thresholdPaceSecPerKm ?? 255,
  });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const zones = useMemo<Zone[]>(() => {
    if (tab === "power") return computePowerZones(values.ftp);
    if (tab === "hr") return computeHrZones(values.thresholdHr);
    return computePaceZones(values.thresholdPaceSecPerKm);
  }, [tab, values]);

  const isPace = tab === "pace";
  const unit = tab === "power" ? "W" : tab === "hr" ? "bpm" : "/km";

  function fmt(v: number | null): string {
    if (v == null) return "∞";
    return isPace ? formatPace(v) : String(v);
  }

  async function saveThresholds() {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "power", label: "Power (Rad)" },
    { id: "hr", label: "Herzfrequenz" },
    { id: "pace", label: "Pace (Lauf)" },
  ];

  const thresholdLabel =
    tab === "power"
      ? `FTP ${values.ftp} W`
      : tab === "hr"
        ? `LTHR ${values.thresholdHr} bpm`
        : `Schwelle ${formatPace(values.thresholdPaceSecPerKm)} /km`;

  return (
    <Card
      title="Trainingszonen"
      subtitle="Power-, HF- und Pace-Zonen aus deinen Schwellenwerten"
      actions={
        <button
          onClick={() => setEditing((e) => !e)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          {editing ? "Schließen" : "Schwellen"}
        </button>
      }
    >
      {editing ? (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <Field
            label="FTP (W)"
            value={values.ftp}
            onChange={(v) => setValues({ ...values, ftp: v })}
          />
          <Field
            label="Schwellen-HF (bpm)"
            value={values.thresholdHr}
            onChange={(v) => setValues({ ...values, thresholdHr: v })}
          />
          <Field
            label="Schwellen-Pace (s/km)"
            value={values.thresholdPaceSecPerKm}
            onChange={(v) => setValues({ ...values, thresholdPaceSecPerKm: v })}
            hint={formatPace(values.thresholdPaceSecPerKm)}
          />
          <button
            onClick={saveThresholds}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Speichern
          </button>
          {saved ? <span className="text-xs text-emerald-600">gespeichert</span> : null}
        </div>
      ) : null}

      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-neutral-400">{thresholdLabel}</span>
      </div>

      <ul className="space-y-1.5">
        {zones.map((z) => (
          <li key={z.id} className="flex items-center gap-3">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: z.color }}
            />
            <span className="w-40 shrink-0 text-sm text-neutral-700">{z.name}</span>
            <span className="text-sm tabular-nums text-neutral-900">
              {isPace
                ? `${fmt(z.hi)} – ${fmt(z.lo)}`
                : `${fmt(z.lo)} – ${fmt(z.hi)}`}{" "}
              <span className="text-xs text-neutral-400">{unit}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="text-xs text-neutral-500">
      {label}
      {hint ? <span className="ml-1 text-neutral-400">({hint})</span> : null}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 block w-32 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
      />
    </label>
  );
}
