"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

export interface NutritionTargetData {
  targetKcal: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
}

/**
 * Manuelles Tagesziel (kein automatisch berechneter BMR/TDEE-Wert) –
 * der Nutzer legt selbst fest, was für ihn ein sinnvolles Ziel ist.
 */
export function NutritionTargets({
  initial,
  onSaved,
}: {
  initial: NutritionTargetData | null;
  onSaved: (target: NutritionTargetData) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NutritionTargetData>(
    initial ?? { targetKcal: null, targetProteinG: null, targetCarbsG: null, targetFatG: null },
  );

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/nutrition/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onSaved(data.target);
        setOpen(false);
        toast("Tagesziel gespeichert.", "success");
      } else {
        toast("Speichern fehlgeschlagen.", "error");
      }
    } catch {
      toast("Netzwerkfehler beim Speichern.", "error");
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, key: keyof NutritionTargetData) {
    return (
      <label className="text-xs text-neutral-500">
        {label}
        <input
          type="number"
          min={0}
          value={form[key] ?? ""}
          onChange={(e) =>
            setForm({ ...form, [key]: e.target.value === "" ? null : Number(e.target.value) })
          }
          className="mt-1 block w-24 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
      >
        Tagesziel bearbeiten
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      {field("Ziel kcal", "targetKcal")}
      {field("Protein (g)", "targetProteinG")}
      {field("Carbs (g)", "targetCarbsG")}
      {field("Fett (g)", "targetFatG")}
      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
      >
        {saving ? "…" : "Speichern"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
      >
        Abbrechen
      </button>
    </div>
  );
}
