"use client";

import { useEffect, useState } from "react";
import { suggestNutritionTargets, buildDefaultChecklist, type ChecklistItem } from "@/domain/training/nutrition";
import { SkeletonLines } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface NutritionPlanData {
  carbsGPerHour: number | null;
  fluidMlPerHour: number | null;
  sodiumMgPerHour: number | null;
  caffeineMg: number | null;
  bikeCarbsGPerHour: number | null;
  runCarbsGPerHour: number | null;
  notes: string | null;
  checklistJson: ChecklistItem[] | null;
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="text-xs text-neutral-500">
      {label}
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
      />
    </label>
  );
}

export function RaceNutritionPanel({ raceId, raceType }: { raceId: string; raceType: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [durationMin, setDurationMin] = useState(180);
  const [carbsGPerHour, setCarbsGPerHour] = useState<number | null>(null);
  const [fluidMlPerHour, setFluidMlPerHour] = useState<number | null>(null);
  const [sodiumMgPerHour, setSodiumMgPerHour] = useState<number | null>(null);
  const [caffeineMg, setCaffeineMg] = useState<number | null>(null);
  const [bikeCarbsGPerHour, setBikeCarbsGPerHour] = useState<number | null>(null);
  const [runCarbsGPerHour, setRunCarbsGPerHour] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/races/${raceId}/nutrition`);
        const data = await res.json();
        if (cancelled) return;
        const plan: NutritionPlanData | null = data.plan;
        if (plan) {
          setCarbsGPerHour(plan.carbsGPerHour);
          setFluidMlPerHour(plan.fluidMlPerHour);
          setSodiumMgPerHour(plan.sodiumMgPerHour);
          setCaffeineMg(plan.caffeineMg);
          setBikeCarbsGPerHour(plan.bikeCarbsGPerHour);
          setRunCarbsGPerHour(plan.runCarbsGPerHour);
          setNotes(plan.notes ?? "");
          setChecklist(
            Array.isArray(plan.checklistJson) && plan.checklistJson.length > 0
              ? plan.checklistJson
              : buildDefaultChecklist(raceType),
          );
        } else {
          setChecklist(buildDefaultChecklist(raceType));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [raceId, raceType]);

  function applySuggestion() {
    const t = suggestNutritionTargets(durationMin);
    setCarbsGPerHour(t.carbsGPerHour);
    setFluidMlPerHour(t.fluidMlPerHour);
    setSodiumMgPerHour(t.sodiumMgPerHour);
    setCaffeineMg(t.caffeineMg);
  }

  function toggleItem(index: number) {
    setChecklist((items) =>
      items.map((it, i) => (i === index ? { ...it, done: !it.done } : it)),
    );
  }

  function removeItem(index: number) {
    setChecklist((items) => items.filter((_, i) => i !== index));
  }

  function addItem() {
    if (!newItem.trim()) return;
    setChecklist((items) => [...items, { label: newItem.trim(), done: false }]);
    setNewItem("");
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/races/${raceId}/nutrition`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carbsGPerHour,
          fluidMlPerHour,
          sodiumMgPerHour,
          caffeineMg,
          bikeCarbsGPerHour,
          runCarbsGPerHour,
          notes: notes || null,
          checklist,
        }),
      });
      if (res.ok) toast("Verpflegungsplan gespeichert.", "success");
      else toast("Speichern fehlgeschlagen.", "error");
    } catch {
      toast("Netzwerkfehler beim Speichern.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <SkeletonLines lines={4} />
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-neutral-500">
          Geschätzte Dauer (min)
          <input
            type="number"
            min={1}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            className="mt-1 block w-24 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={applySuggestion}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Vorschlag berechnen
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Carbs (g/h)" value={carbsGPerHour} onChange={setCarbsGPerHour} />
        <NumberField label="Flüssigkeit (ml/h)" value={fluidMlPerHour} onChange={setFluidMlPerHour} />
        <NumberField label="Natrium (mg/h)" value={sodiumMgPerHour} onChange={setSodiumMgPerHour} />
        <NumberField label="Koffein (mg)" value={caffeineMg} onChange={setCaffeineMg} />
        <NumberField label="Carbs Rad (g/h)" value={bikeCarbsGPerHour} onChange={setBikeCarbsGPerHour} />
        <NumberField label="Carbs Lauf (g/h)" value={runCarbsGPerHour} onChange={setRunCarbsGPerHour} />
      </div>

      <label className="mt-3 block text-xs text-neutral-500">
        Notizen
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>

      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Checkliste
        </p>
        <ul className="space-y-1">
          {checklist.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggleItem(i)}
                className="h-4 w-4 accent-blue-600"
              />
              <span className={item.done ? "text-neutral-400 line-through" : "text-neutral-700"}>
                {item.label}
              </span>
              <button
                onClick={() => removeItem(i)}
                className="ml-auto text-neutral-300 hover:text-rose-500"
                aria-label="Punkt entfernen"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Neuer Punkt…"
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
          />
          <button
            onClick={addItem}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Hinzufügen
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {saving ? "Speichere…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
