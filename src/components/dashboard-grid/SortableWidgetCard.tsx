"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WidgetCard } from "./WidgetCard";
import type { WidgetSize } from "./types";

export function SortableWidgetCard({
  id,
  title,
  size,
  editMode,
  onSizeChange,
  onRemove,
  children,
}: {
  id: string;
  title: string;
  size: WidgetSize;
  editMode: boolean;
  onSizeChange: (size: WidgetSize) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editMode,
  });

  return (
    <WidgetCard
      ref={setNodeRef}
      title={title}
      size={size}
      editMode={editMode}
      onSizeChange={onSizeChange}
      onRemove={onRemove}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "z-10 opacity-60 shadow-lg" : undefined}
      dragHandle={
        editMode ? (
          <button
            type="button"
            aria-label={`${title} verschieben`}
            className="flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
        ) : null
      }
    >
      {children}
    </WidgetCard>
  );
}
