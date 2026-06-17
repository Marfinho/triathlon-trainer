"use client";

import { useState } from "react";
import { Card } from "@/components/dashboard/Card";

type Json = number | null | boolean | string[];
type LimitsMap = Record<string, Json>;

export interface TierConfig {
  tier: string;
  defaults: LimitsMap;
  effective: LimitsMap;
  override: Record<string, unknown> | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

const NUMERIC_FIELDS: {
  key: string;
  label: string;
  unit: string;
  allowUnlimited: boolean;
}[] = [
  { key: "planHorizonDays", label: "Plan-Horizont", unit: "Tage", allowUnlimited: true },
  { key: "maxRaceEvents", label: "Max. Rennen", unit: "Anzahl", allowUnlimited: true },
  { key: "maxPlanImportsPerMonth", label: "Plan-Importe / Monat", unit: "Anzahl", allowUnlimited: true },
  { key: "maxGearItems", label: "Max. Geräte", unit: "Anzahl", allowUnlimited: true },
  { key: "maxGearComponents", label: "Max. Komponenten", unit: "Anzahl", allowUnlimited: true },
  { key: "maxActiveIntegrations", label: "Aktive Integrationen", unit: "Anzahl", allowUnlimited: true },
  { key: "activityHistoryDays", label: "Aktivitäts-Historie", unit: "Tage", allowUnlimited: true },
  { key: "pmcHorizonDays", label: "PMC-Horizont", unit: "Tage", allowUnlimited: true },
  { key: "syncIntervalMinutes", label: "Sync-Intervall", unit: "Minuten", allowUnlimited: false },
  { key: "manualBackupCooldownHours", label: "Backup-Cooldown", unit: "Stunden", allowUnlimited: false },
];

const PREDICTION_SPORTS = ["run", "bike", "swim", "triathlon"];
const SPORT_LABELS: Record<string, string> = {
  run: "Laufen",
  bike: "Rad",
  swim: "Schwimmen",
  triathlon: "Triathlon",
};

function tierLabel(tier: string): string {
  if (tier === "free") return "Free";
  if (tier === "paid") return "Paid";
  return tier;
}

export function PlanLimitsEditor({ initialTiers }: { initialTiers: TierConfig[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {initialTiers.map((t) => (
        <TierEditor key={t.tier} config={t} />
      ))}
    </div>
  );
}

function TierEditor({ config }: { config: TierConfig }) {
  const [values, setValues] = useState<LimitsMap>(() => ({ ...config.effective }));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(config.updatedAt);

  function setField(key: string, value: Json) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setMsg(null);
  }

  function toggleSport(sport: string) {
    const current = Array.isArray(values.allowedPredictionSports)
      ? (values.allowedPredictionSports as string[])
      : [];
    const next = current.includes(sport)
      ? current.filter((s) => s !== sport)
      : [...current, sport];
    setField("allowedPredictionSports", next);
  }

  function resetToDefaults() {
    setValues({ ...config.defaults });
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/plan-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: config.tier, settings: values }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: data.error ?? `Fehler (${res.status})` });
      } else {
        const data = await res.json();
        if (data.effective) setValues(data.effective as LimitsMap);
        setUpdatedAt(new Date().toISOString());
        setMsg({ ok: true, text: "Gespeichert." });
      }
    } catch {
      setMsg({ ok: false, text: "Netzwerkfehler." });
    } finally {
      setSaving(false);
    }
  }

  const selectedSports = Array.isArray(values.allowedPredictionSports)
    ? (values.allowedPredictionSports as string[])
    : [];
  const weeklyReport = values.weeklyReport === true;

  return (
    <Card
      title={`Tier: ${tierLabel(config.tier)}`}
      subtitle={
        updatedAt
          ? `Override aktiv · zuletzt ${new Date(updatedAt).toLocaleString("de-DE")}`
          : "Standardwerte (kein Override)"
      }
      actions={
        <button
          type="button"
          onClick={resetToDefaults}
          className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-800"
        >
          Auf Standard
        </button>
      }
    >
      <div className="space-y-3">
        {NUMERIC_FIELDS.map((f) => {
          const raw = values[f.key];
          const isUnlimited = raw === null;
          return (
            <div key={f.key} className="flex items-center justify-between gap-3">
              <label className="text-sm text-neutral-700">
                {f.label}
                <span className="ml-1 text-[11px] text-neutral-400">({f.unit})</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  disabled={isUnlimited}
                  value={isUnlimited ? "" : (typeof raw === "number" ? raw : 0)}
                  onChange={(e) =>
                    setField(f.key, e.target.value === "" ? 0 : Number(e.target.value))
                  }
                  className="w-24 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-right text-sm tabular-nums text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-300"
                />
                {f.allowUnlimited && (
                  <label className="flex items-center gap-1 text-[11px] text-neutral-500">
                    <input
                      type="checkbox"
                      checked={isUnlimited}
                      onChange={(e) => setField(f.key, e.target.checked ? null : 0)}
                    />
                    ∞
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="mb-2 text-xs font-medium text-neutral-600">
          Vorhersage-Sportarten
        </p>
        <div className="flex flex-wrap gap-2">
          {PREDICTION_SPORTS.map((sport) => {
            const active = selectedSports.includes(sport);
            return (
              <button
                key={sport}
                type="button"
                onClick={() => toggleSport(sport)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
                }`}
              >
                {SPORT_LABELS[sport] ?? sport}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
        <div>
          <p className="text-sm font-medium text-neutral-700">Wochenbericht</p>
          <p className="text-[11px] text-neutral-400">Pay-Feature (weeklyReport)</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={weeklyReport}
          onClick={() => setField("weeklyReport", !weeklyReport)}
          className={`relative h-6 w-11 rounded-full transition ${
            weeklyReport ? "bg-green-500" : "bg-neutral-200"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              weeklyReport ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-neutral-100 pt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
        {msg && (
          <span
            className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </Card>
  );
}
