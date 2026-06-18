"use client";

import { useMemo, useState } from "react";
import { Card, sportLabel, sportColor } from "./Card";
import { EmptyState } from "@/components/ui/EmptyState";

export interface ActivityItem {
  id: string;
  date: string;
  sport: string;
  durationMin: number | null;
  distanceKm: number | null;
  load: number | null;
  source: string;
}

export interface WeekSummary {
  sessions: number;
  hours: number;
  distanceKm: number;
  load: number;
}

const PAGE_SIZE = 8;

export function RecentActivities({
  items,
  summary,
}: {
  items: ActivityItem[];
  summary?: WeekSummary;
}) {
  const [query, setQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const sports = useMemo(
    () => [...new Set(items.map((a) => a.sport))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((a) => {
      if (sportFilter && a.sport !== sportFilter) return false;
      if (!q) return true;
      return (
        sportLabel(a.sport).toLowerCase().includes(q) ||
        a.date.includes(q) ||
        a.source.toLowerCase().includes(q)
      );
    });
  }, [items, query, sportFilter]);

  const shown = filtered.slice(0, visible);

  return (
    <Card
      title="Letzte Aktivitäten"
      subtitle="Ist-Daten aus Intervals.icu / Radrolle / manuell"
    >
      {summary ? (
        <div className="mb-4 grid grid-cols-4 gap-2">
          <SummaryTile label="Einheiten" value={String(summary.sessions)} />
          <SummaryTile label="Stunden" value={summary.hours.toFixed(1)} />
          <SummaryTile label="km" value={Math.round(summary.distanceKm).toString()} />
          <SummaryTile label="Load" value={Math.round(summary.load).toString()} />
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Suchen (Sport, Datum, Quelle)…"
            aria-label="Aktivitäten durchsuchen"
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
          />
          <select
            value={sportFilter}
            onChange={(e) => {
              setSportFilter(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            aria-label="Nach Sportart filtern"
            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="">Alle Sportarten</option>
            {sports.map((s) => (
              <option key={s} value={s}>
                {sportLabel(s)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="Keine Ist-Aktivitäten erfasst"
          hint="Synchronisiere Intervals.icu oder zeichne eine Einheit auf der Radrolle auf."
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Keine Treffer" hint="Passe Suche oder Filter an." />
      ) : (
        <>
          <ul className="divide-y divide-neutral-100">
            {shown.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: sportColor(a.sport) }}
                  />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {sportLabel(a.sport)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {a.date} ·{" "}
                      {a.durationMin ? `${Math.round(a.durationMin)} min` : "—"}
                      {a.distanceKm ? ` · ${a.distanceKm.toFixed(1)} km` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-neutral-400">
                  {a.load ? `Load ${Math.round(a.load)}` : a.source}
                </span>
              </li>
            ))}
          </ul>
          {visible < filtered.length ? (
            <button
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mt-3 w-full rounded-lg border border-neutral-300 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
            >
              Mehr laden ({filtered.length - visible} weitere)
            </button>
          ) : null}
        </>
      )}
    </Card>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-neutral-900">{value}</p>
    </div>
  );
}
