"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { SizeSelector } from "./SizeSelector";
import { SIZE_SPAN_CLASS, type WidgetSize } from "./types";

export const WidgetCard = forwardRef<
  HTMLDivElement,
  {
    title: string;
    size: WidgetSize;
    editMode: boolean;
    onSizeChange: (size: WidgetSize) => void;
    onRemove: () => void;
    dragHandle?: ReactNode;
    style?: CSSProperties;
    className?: string;
    children: ReactNode;
  }
>(function WidgetCard(
  { title, size, editMode, onSizeChange, onRemove, dragHandle, style, className, children },
  ref,
) {
  return (
    <div
      ref={ref}
      style={style}
      className={`${SIZE_SPAN_CLASS[size]} ${className ?? ""} rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {dragHandle}
          <h3 className="truncate text-sm font-semibold tracking-tight text-neutral-900">
            {title}
          </h3>
        </div>
        {editMode && (
          <div className="flex items-center gap-2">
            <SizeSelector value={size} onChange={onSizeChange} />
            <button
              type="button"
              onClick={onRemove}
              aria-label={`${title} entfernen`}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-rose-50 hover:text-rose-600"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {children}
    </div>
  );
});
