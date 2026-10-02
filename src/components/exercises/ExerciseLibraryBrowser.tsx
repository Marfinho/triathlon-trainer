"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Exercise3dDefinition } from "@/domain/exercises/body3d";
import { ExerciseFigure } from "./ExerciseFigure";
import { Exercise3dStill } from "./Exercise3dStill";

export interface LibraryListItem {
  id: string;
  title: string;
  subtitle: string;
  category: "strength" | "mobility";
  muscles: string[];
  custom: boolean;
  /** Serverseitig gerendertes Thumb (Engine-Ausgabe) */
  thumbSvg: string;
  /** 3D-Übung: Vorschau wird im Browser aus dem Körpermodell gerendert */
  definition3d?: Exercise3dDefinition;
}

const FILTERS = [
  { value: "all", label: "Alle" },
  { value: "strength", label: "Kraft" },
  { value: "mobility", label: "Mobility" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

function normalize(s: string): string {
  return s.toLocaleLowerCase("de-DE");
}

/** Liste mit Filter (Alle/Kraft/Mobility) und Suche nach Titel und Muskel. */
export function ExerciseLibraryBrowser({ items }: { items: LibraryListItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return items.filter((it) => {
      if (filter !== "all" && it.category !== filter) return false;
      if (!q) return true;
      return (
        normalize(it.title).includes(q) ||
        normalize(it.subtitle).includes(q) ||
        it.muscles.some((m) => normalize(m).includes(q))
      );
    });
  }, [items, filter, query]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Kategorie" className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                filter === f.value
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="min-w-[12rem] flex-1">
          <span className="sr-only">Suche nach Titel oder Muskel</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach Titel oder Muskel…"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400"
          />
        </label>
      </div>

      <p className="mb-2 text-xs text-neutral-500" aria-live="polite">
        {visible.length} {visible.length === 1 ? "Übung" : "Übungen"}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          Keine Übung gefunden.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((it) => (
            <li key={it.id}>
              <Link
                href={`/trainer/uebungen/${it.id}`}
                className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-3 transition hover:border-neutral-300 hover:shadow-sm"
              >
                {it.definition3d ? (
                  <Exercise3dStill
                    definition={it.definition3d}
                    spec={{ kind: "thumb" }}
                    svg={it.thumbSvg}
                    label={it.title}
                    className="w-24 shrink-0 self-start"
                  />
                ) : (
                  <ExerciseFigure svg={it.thumbSvg} className="w-24 shrink-0 self-start" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900">{it.title}</p>
                  <p className="text-xs text-neutral-600">{it.subtitle}</p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded bg-neutral-100 px-1.5 text-[11px] text-neutral-700">
                      {it.category === "strength" ? "Kraft" : "Mobility"}
                    </span>
                    {it.custom ? (
                      <span className="rounded bg-violet-50 px-1.5 text-[11px] text-violet-700">
                        Eigene Übung
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                    {it.muscles.join(", ")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
