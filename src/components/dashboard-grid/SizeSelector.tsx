"use client";

import { WIDGET_SIZES, SIZE_LABEL, type WidgetSize } from "./types";

export function SizeSelector({
  value,
  onChange,
}: {
  value: WidgetSize;
  onChange: (size: WidgetSize) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Widget-Größe">
      {WIDGET_SIZES.map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          aria-pressed={value === size}
          aria-label={`Größe ${SIZE_LABEL[size]}`}
          className={`flex h-11 w-11 items-center justify-center rounded-lg text-sm font-semibold transition ${
            value === size
              ? "bg-blue-600 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          {size}
        </button>
      ))}
    </div>
  );
}
