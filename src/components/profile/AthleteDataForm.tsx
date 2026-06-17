"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/dashboard/Card";
import { TagInput } from "./TagInput";

const SPORT_OPTIONS = [
  { id: "swim", label: "Schwimmen" },
  { id: "bike", label: "Rad" },
  { id: "run", label: "Laufen" },
  { id: "strength", label: "Kraft" },
  { id: "brick", label: "Koppel" },
];

const TRAINING_LEVELS = [
  { id: "beginner", label: "Einsteiger" },
  { id: "intermediate", label: "Fortgeschritten" },
  { id: "advanced", label: "Ambitioniert" },
  { id: "elite", label: "Elite" },
];

export interface AthleteDataInitial {
  name: string;
  heightCm: number | null;
  weightKg: number | null;
  ftpWatts: number | null;
  thresholdHr: number | null;
  thresholdPaceSecPerKm: number | null;
  thresholdSwimPer100m: number | null;
  trainingLevel: string | null;
  primarySports: string[];
  knownLimiters: string[];
  equipment: string[];
}

function NumberField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="text-xs text-neutral-500">
      {label} <span className="text-neutral-400">({unit})</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
      />
    </label>
  );
}

export function AthleteDataForm({ initial }: { initial: AthleteDataInitial }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function setField<K extends keyof AthleteDataInitial>(key: K, value: AthleteDataInitial[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMsg(null);
  }

  function toggleSport(sport: string) {
    setField(
      "primarySports",
      form.primarySports.includes(sport)
        ? form.primarySports.filter((s) => s !== sport)
        : [...form.primarySports, sport],
    );
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMsg("Gespeichert.");
        router.refresh();
      } else {
        setMsg("Fehler beim Speichern.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Athletendaten" subtitle="Stammdaten, Schwellenwerte und Trainingsprofil">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-xs text-neutral-500">
          Profilname
          <input
            type="text"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Trainingslevel
          <select
            value={form.trainingLevel ?? ""}
            onChange={(e) => setField("trainingLevel", e.target.value || null)}
            className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="">— wählen —</option>
            {TRAINING_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <NumberField label="Größe" unit="cm" value={form.heightCm} onChange={(v) => setField("heightCm", v)} />
        <NumberField label="Gewicht" unit="kg" value={form.weightKg} onChange={(v) => setField("weightKg", v)} />
        <NumberField label="FTP" unit="Watt" value={form.ftpWatts} onChange={(v) => setField("ftpWatts", v)} />
        <NumberField
          label="Schwellenpuls"
          unit="bpm"
          value={form.thresholdHr}
          onChange={(v) => setField("thresholdHr", v)}
        />
        <NumberField
          label="Schwellenpace Lauf"
          unit="s/km"
          value={form.thresholdPaceSecPerKm}
          onChange={(v) => setField("thresholdPaceSecPerKm", v)}
        />
        <NumberField
          label="Schwellenpace Schwimmen"
          unit="s/100m"
          value={form.thresholdSwimPer100m}
          onChange={(v) => setField("thresholdSwimPer100m", v)}
        />
      </div>

      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="mb-2 text-xs font-medium text-neutral-600">Hauptsportarten</p>
        <div className="flex flex-wrap gap-2">
          {SPORT_OPTIONS.map((s) => {
            const active = form.primarySports.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSport(s.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-neutral-100 pt-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium text-neutral-600">Bekannte Limiter</p>
          <TagInput
            values={form.knownLimiters}
            onChange={(v) => setField("knownLimiters", v)}
            placeholder="z.B. Achillessehne…"
          />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-neutral-600">Ausrüstung</p>
          <TagInput
            values={form.equipment}
            onChange={(v) => setField("equipment", v)}
            placeholder="z.B. Canyon Aeroad…"
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-neutral-100 pt-4">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
        {msg && <span className="text-xs text-neutral-500">{msg}</span>}
      </div>
    </Card>
  );
}
