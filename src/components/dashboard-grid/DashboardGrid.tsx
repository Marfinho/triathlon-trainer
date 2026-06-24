"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { EditModeToolbar } from "./EditModeToolbar";
import { WidgetCard } from "./WidgetCard";
import type { WidgetInstance, WidgetSize } from "./types";

const WIDGET_LABEL: Record<string, string> = {
  TodayWorkout: "Heutiges Training",
  FormGauge: "Form",
  ReadinessCheckin: "Readiness-Check-in",
};

export function DashboardGrid({ initialWidgets }: { initialWidgets: WidgetInstance[] }) {
  const { toast } = useToast();
  const [savedWidgets, setSavedWidgets] = useState(initialWidgets);
  const [widgets, setWidgets] = useState(initialWidgets);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(widgets) !== JSON.stringify(savedWidgets);

  function updateSize(id: string, size: WidgetSize) {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, size } : w)));
  }

  function removeWidget(id: string) {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }

  function handleCancel() {
    setWidgets(savedWidgets);
    setEditMode(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layoutJson: { widgets } }),
      });
      if (!res.ok) throw new Error("Speichern fehlgeschlagen");
      setSavedWidgets(widgets);
      setEditMode(false);
      toast("Layout gespeichert.", "success");
    } catch {
      toast("Layout konnte nicht gespeichert werden.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <EditModeToolbar
        editMode={editMode}
        dirty={dirty}
        saving={saving}
        onToggleEdit={() => setEditMode((v) => !v)}
        onSave={handleSave}
        onCancel={handleCancel}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-5">
        {widgets.map((widget) => (
          <WidgetCard
            key={widget.id}
            title={WIDGET_LABEL[widget.type] ?? widget.type}
            size={widget.size}
            editMode={editMode}
            onSizeChange={(size) => updateSize(widget.id, size)}
            onRemove={() => removeWidget(widget.id)}
          >
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-neutral-200 text-xs text-neutral-400">
              Platzhalter
            </div>
          </WidgetCard>
        ))}
        {widgets.length === 0 && (
          <p className="col-span-1 text-sm text-neutral-500 md:col-span-4">
            Keine Widgets. Im Bearbeitungsmodus kannst du sie später aus der
            Galerie hinzufügen.
          </p>
        )}
      </div>
    </div>
  );
}
