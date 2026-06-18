"use client";

import { useEffect, useState } from "react";
import { Card, sportLabel, sportColor } from "./Card";
import { WorkoutProfile } from "./WorkoutProfile";
import type { CalendarDay, CalendarItem } from "@/domain/training/calendar";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const SPORT_ABBR: Record<string, string> = {
  swim: "Sw",
  bike: "Rad",
  run: "Lauf",
  strength: "Kraft",
  brick: "Kop",
  rest: "Rest",
};

const STATUS_LABEL: Record<string, string> = {
  planned: "geplant",
  synced: "synchronisiert",
  completed: "erledigt",
  skipped: "ausgelassen",
};

function abbr(sport: string): string {
  return SPORT_ABBR[sport] ?? sport.slice(0, 3);
}

function fmtFullDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function TrainingCalendar({
  grid,
  ftp = 200,
}: {
  grid: CalendarDay[][];
  ftp?: number;
}) {
  const [openDay, setOpenDay] = useState<CalendarDay | null>(null);

  return (
    <Card
      title="Trainingskalender"
      subtitle="Geplant (Umriss) und absolviert (gefüllt) – Tag anklicken für Details"
    >
      <div className="flex gap-1">
        <div className="grid flex-1 grid-cols-7 gap-1 text-center text-[11px] font-medium text-neutral-400">
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-1">
              {d}
            </div>
          ))}
        </div>
        <div className="w-14 pb-1 text-center text-[11px] font-medium text-neutral-400">
          Σ Std
        </div>
      </div>
      <div className="space-y-1">
        {grid.map((week, wi) => {
          const sumKind = (kind: "actual" | "planned") =>
            week.reduce(
              (sum, d) =>
                sum +
                d.items
                  .filter((it) => it.kind === kind)
                  .reduce((s, it) => s + it.durationMin, 0),
              0,
            );
          const actualMin = sumKind("actual");
          const plannedMin = sumKind("planned");
          const isCurrentWeek = week.some((d) => d.isToday);
          return (
            <div
              key={wi}
              className={`flex items-stretch gap-1 rounded-lg ${
                isCurrentWeek ? "ring-1 ring-blue-200" : ""
              }`}
            >
              <div className="grid flex-1 grid-cols-7 gap-1">
                {week.map((day) => (
                  <DayCell key={day.date} day={day} onOpen={() => setOpenDay(day)} />
                ))}
              </div>
              <div className="flex w-14 flex-col items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 text-center leading-tight">
                <span className="text-sm font-semibold text-neutral-700">
                  {(actualMin / 60).toFixed(1)}
                </span>
                <span className="text-[10px] text-neutral-400">
                  /{(plannedMin / 60).toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <Legend />
      {openDay ? (
        <DayModal day={openDay} ftp={ftp} onClose={() => setOpenDay(null)} />
      ) : null}
    </Card>
  );
}

function DayCell({ day, onOpen }: { day: CalendarDay; onOpen: () => void }) {
  const dayNum = day.date.slice(8, 10);
  const hasItems = day.items.length > 0;
  return (
    <button
      type="button"
      onClick={hasItems ? onOpen : undefined}
      disabled={!hasItems}
      aria-label={`${day.date}${hasItems ? ` – ${day.items.length} Einheit(en), Details öffnen` : ""}`}
      className={`min-h-[68px] rounded-lg border p-1.5 text-left transition ${
        day.isToday
          ? "border-blue-400 bg-blue-50/40"
          : day.inPast
            ? "border-neutral-100 bg-neutral-50/40"
            : "border-neutral-200 bg-white"
      } ${hasItems ? "cursor-pointer hover:border-blue-300 hover:shadow-sm" : "cursor-default"}`}
    >
      <div
        className={`mb-1 text-right text-[10px] ${
          day.isToday ? "font-semibold text-blue-600" : "text-neutral-400"
        }`}
      >
        {dayNum}
      </div>
      <div className="space-y-0.5">
        {day.items.slice(0, 3).map((it, i) => (
          <Chip key={i} item={it} />
        ))}
        {day.items.length > 3 ? (
          <div className="text-[10px] text-neutral-400">+{day.items.length - 3} mehr</div>
        ) : null}
      </div>
    </button>
  );
}

/** Kompakter Eintrag in der Tageszelle: absolviert = gefüllt, geplant = Umriss. */
function Chip({ item }: { item: CalendarItem }) {
  const color = sportColor(item.sport);
  const done = item.kind === "actual" || item.status === "completed";
  return (
    <div
      className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]"
      style={
        done
          ? { backgroundColor: `${color}22`, color: "#1d1d1f" }
          : { border: `1px solid ${color}55`, color: "#6e6e73" }
      }
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">
        {abbr(item.sport)} {item.durationMin}′
      </span>
    </div>
  );
}

function DayModal({
  day,
  ftp,
  onClose,
}: {
  day: CalendarDay;
  ftp: number;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const planned = day.items.filter((it) => it.kind === "planned");
  const actual = day.items.filter((it) => it.kind === "actual");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-neutral-900">{fmtFullDate(day.date)}</h3>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-lg px-2 py-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            ✕
          </button>
        </div>

        {planned.length === 0 && actual.length === 0 ? (
          <p className="text-sm text-neutral-400">Kein Training an diesem Tag.</p>
        ) : (
          <div className="space-y-4">
            {planned.length > 0 ? (
              <section>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Geplant
                </h4>
                <ul className="space-y-2">
                  {planned.map((it, i) => (
                    <DetailRow key={i} item={it} ftp={ftp} />
                  ))}
                </ul>
              </section>
            ) : null}
            {actual.length > 0 ? (
              <section>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Absolviert
                </h4>
                <ul className="space-y-2">
                  {actual.map((it, i) => (
                    <DetailRow key={i} item={it} ftp={ftp} />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ item, ftp }: { item: CalendarItem; ftp: number }) {
  const color = sportColor(item.sport);
  const facts: string[] = [`${item.durationMin}′`];
  if (item.distanceKm != null && item.distanceKm > 0) {
    facts.push(
      item.sport === "swim"
        ? `${Math.round(item.distanceKm * 1000)} m`
        : `${item.distanceKm.toFixed(1)} km`,
    );
  }
  if (item.load != null && item.load > 0) facts.push(`Load ${Math.round(item.load)}`);
  if (item.avgHr != null && item.avgHr > 0) facts.push(`${item.avgHr} bpm`);
  if (item.rpe != null && item.rpe > 0) facts.push(`RPE ${item.rpe}`);

  return (
    <li className="rounded-xl border border-neutral-200 p-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-neutral-900">
          {item.kind === "planned" ? item.label : sportLabel(item.sport)}
        </span>
        {item.kind === "planned" && item.status ? (
          <span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
            {STATUS_LABEL[item.status] ?? item.status}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {sportLabel(item.sport)} · {facts.join(" · ")}
      </p>
      {item.description ? (
        <p className="mt-1.5 text-xs text-neutral-500">{item.description}</p>
      ) : null}
      {item.kind === "planned" && item.segments && item.segments.length > 0 ? (
        <div className="mt-3">
          <WorkoutProfile segments={item.segments} ftp={ftp} sport={item.sport} />
        </div>
      ) : null}
    </li>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex items-center gap-4 text-[11px] text-neutral-500">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-neutral-300" /> geplant
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-neutral-200" /> absolviert
      </span>
    </div>
  );
}
