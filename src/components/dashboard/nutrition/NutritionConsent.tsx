"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * DSGVO Art. 9: Ernährungs-/Gesundheitsdaten dürfen erst nach expliziter
 * Einwilligung verarbeitet werden. Ohne Zustimmung bleiben alle
 * /api/nutrition/*-Routen mit 403 gesperrt (server-seitig erzwungen, siehe
 * src/lib/nutrition-consent.ts) – dieses Banner ist nur die UI dafür.
 */
export function NutritionConsent({ onGranted }: { onGranted: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  async function grant() {
    setSaving(true);
    try {
      const res = await fetch("/api/nutrition/consent", { method: "POST" });
      if (res.ok) {
        onGranted();
      } else {
        toast("Einwilligung konnte nicht gespeichert werden.", "error");
      }
    } catch {
      toast("Netzwerkfehler beim Speichern der Einwilligung.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">
        Einwilligung zur Ernährungs-Erfassung
      </h2>
      <p className="mt-2 max-w-xl text-sm text-neutral-500">
        Um Lebensmittel, Kalorien und Makros zu erfassen, benötigen wir deine
        ausdrückliche Einwilligung zur Verarbeitung dieser Gesundheitsdaten
        (Art. 9 DSGVO). Ohne Einwilligung bleibt dieser Bereich gesperrt – es
        läuft nichts automatisch im Hintergrund. Du kannst die Einwilligung
        jederzeit in deinem Profil widerrufen; bereits erfasste Daten bleiben
        dabei erhalten und können über den bestehenden Export gesichert oder
        gelöscht werden.
      </p>
      <button
        onClick={grant}
        disabled={saving}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
      >
        {saving ? "…" : "Zustimmen & Ernährungstracking aktivieren"}
      </button>
    </div>
  );
}
