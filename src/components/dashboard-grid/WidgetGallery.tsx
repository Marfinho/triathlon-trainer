"use client";

import { useMemo } from "react";
import { WIDGET_CATALOG, type WidgetCatalogEntry } from "./catalog";

export function WidgetGallery({
  open,
  existingTypes,
  onAdd,
  onClose,
}: {
  open: boolean;
  existingTypes: string[];
  onAdd: (type: string) => void;
  onClose: () => void;
}) {
  const grouped = useMemo(() => {
    const available = WIDGET_CATALOG.filter((w) => !existingTypes.includes(w.type));
    const map = new Map<string, WidgetCatalogEntry[]>();
    for (const entry of available) {
      map.set(entry.category, [...(map.get(entry.category) ?? []), entry]);
    }
    return map;
  }, [existingTypes]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Widget-Galerie"
    >
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <div className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl md:max-h-[80vh] md:w-full md:max-w-lg md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Widget hinzufügen</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            ✕
          </button>
        </div>

        {grouped.size === 0 ? (
          <p className="text-sm text-neutral-500">
            Alle verfügbaren Widgets sind bereits auf deinem Dashboard.
          </p>
        ) : (
          <div className="space-y-5">
            {[...grouped.entries()].map(([category, entries]) => (
              <div key={category}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  {category}
                </h3>
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <button
                      key={entry.type}
                      type="button"
                      onClick={() => onAdd(entry.type)}
                      className="flex min-h-[44px] w-full flex-col items-start gap-0.5 rounded-xl border border-neutral-200 px-4 py-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      <span className="text-sm font-medium text-neutral-900">
                        {entry.label}
                      </span>
                      <span className="text-xs text-neutral-500">{entry.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
