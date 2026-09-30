"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useToast } from "@/components/ui/Toast";
import { catalogEntry } from "./catalog";
import { EditModeToolbar } from "./EditModeToolbar";
import { SortableWidgetCard } from "./SortableWidgetCard";
import { WidgetGallery } from "./WidgetGallery";
import { WIDGET_COMPONENTS } from "./widgetRegistry";
import type { WidgetInstance, WidgetSize } from "./types";

export function DashboardGrid({ initialWidgets }: { initialWidgets: WidgetInstance[] }) {
  const { toast } = useToast();
  const [savedWidgets, setSavedWidgets] = useState(initialWidgets);
  const [widgets, setWidgets] = useState(initialWidgets);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dirty = JSON.stringify(widgets) !== JSON.stringify(savedWidgets);

  function updateSize(id: string, size: WidgetSize) {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, size } : w)));
  }

  function removeWidget(id: string) {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }

  function addWidget(type: string) {
    const entry = catalogEntry(type);
    if (!entry) return;
    setWidgets((prev) => [
      ...prev,
      { id: `${type}-${crypto.randomUUID()}`, type, size: entry.defaultSize },
    ]);
    setGalleryOpen(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWidgets((prev) => {
      const oldIndex = prev.findIndex((w) => w.id === active.id);
      const newIndex = prev.findIndex((w) => w.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
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
        onAddWidget={() => setGalleryOpen(true)}
      />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-5">
            {widgets.map((widget) => {
              const Content = WIDGET_COMPONENTS[widget.type];
              return (
                <SortableWidgetCard
                  key={widget.id}
                  id={widget.id}
                  title={catalogEntry(widget.type)?.label ?? widget.type}
                  size={widget.size}
                  editMode={editMode}
                  onSizeChange={(size) => updateSize(widget.id, size)}
                  onRemove={() => removeWidget(widget.id)}
                >
                  {Content ? (
                    <Content size={widget.size} />
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-neutral-200 text-xs text-neutral-400">
                      Platzhalter
                    </div>
                  )}
                </SortableWidgetCard>
              );
            })}
            {widgets.length === 0 && (
              <p className="col-span-1 text-sm text-neutral-500 md:col-span-4">
                Keine Widgets. Über &quot;Widget hinzufügen&quot; im Bearbeitungsmodus
                kannst du dein Dashboard zusammenstellen.
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>
      <WidgetGallery
        open={galleryOpen}
        existingTypes={widgets.map((w) => w.type)}
        onAdd={addWidget}
        onClose={() => setGalleryOpen(false)}
      />
    </div>
  );
}
