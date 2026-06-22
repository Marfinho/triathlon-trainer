"use client";

import { useEffect, useState } from "react";
import { Card, sportLabel, sportColor } from "./Card";
import { WorkoutProfile } from "./WorkoutProfile";
import {
  buildWorkoutProfile,
  summarizeProfile,
} from "@/domain/training/workoutProfile";
import type { CalendarDay, CalendarItem } from "@/domain/training/calendar";
import { forecastWorkoutEnergy } from "@/domain/nutrition/forecast";

const FORECAST_CONFIDENCE_LABEL: Record<string, string> = {
  high: "hohe Konfidenz",
  medium: "mittlere Konfidenz",
  low: "niedrige Konfidenz",
};

const SOURCE_LABEL: Record<string, string> = {
  intervals: "Intervals.icu",
  strava: "Strava",
  wahoo: "Wahoo",
  manual: "manuell",
  trainer: "Radrolle",
};

/** Pace/Tempo je Sportart aus Dauer + Distanz. */
function derivePace(
  sport: string,
  durationMin: number,
  distanceKm: number | null | undefined,
): string | null {
  if (durationMin <= 0 || distanceKm == null || distanceKm <= 0) return null;
  if (sport === "bike") {
    const kmh = distanceKm / (durationMin / 60);
    return `${kmh.toFixed(1)} km/h`;
  }
  if (sport === "swim") {
    const secPer100 = (durationMin * 60) / (distanceKm * 10);
    const m = Math.floor(secPer100 / 60);
    const s = Math.round(secPer100 % 60);
    return `${m}:${String(s).padStart(2, "0")}/100m`;
  }
  const secPerKm = (durationMin * 60) / distanceKm;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

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
  weightKg = null,
}: {
  grid: CalendarDay[][];
  ftp?: number;
  weightKg?: number | null;
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
        <DayModal day={openDay} ftp={ftp} weightKg={weightKg} onClose={() => setOpenDay(null)} />
      ) : null}
    </Card>
  );
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

function DayCell({ day, onOpen }: { day: CalendarDay; onOpen: () => void }) {
  const dayNum = day.date.slice(8, 10);
  // Am Monatsersten den Monat anzeigen, damit das Gitter zeitlich verortet ist.
  const monthTag =
    dayNum === "01" ? MONTH_ABBR[Number(day.date.slice(5, 7)) - 1] ?? "" : "";
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
        className={`mb-1 flex items-center justify-between text-[10px] ${
          day.isToday ? "font-semibold text-blue-600" : "text-neutral-400"
        }`}
      >
        <span className="font-medium text-neutral-400">{monthTag}</span>
        <span>{dayNum}</span>
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
  weightKg,
  onClose,
}: {
  day: CalendarDay;
  ftp: number;
  weightKg: number | null;
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
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Trainingsdetails ${fmtFullDate(day.date)}`}
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
            <DaySummary planned={planned} actual={actual} />
            {planned.length > 0 ? (
              <section>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Geplant
                </h4>
                <ul className="space-y-2">
                  {planned.map((it, i) => (
                    <DetailRow key={i} item={it} ftp={ftp} date={day.date} weightKg={weightKg} />
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
                    <DetailRow key={i} item={it} ftp={ftp} date={day.date} weightKg={weightKg} />
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

function DaySummary({
  planned,
  actual,
}: {
  planned: CalendarItem[];
  actual: CalendarItem[];
}) {
  const plannedMin = planned.reduce((s, it) => s + it.durationMin, 0);
  const actualMin = actual.reduce((s, it) => s + it.durationMin, 0);
  const actualLoad = actual.reduce((s, it) => s + (it.load ?? 0), 0);

  return (
    <div className="grid grid-cols-3 gap-1.5">
      <Stat
        label="Geplant"
        value={planned.length ? `${planned.length} · ${Math.round((plannedMin / 60) * 10) / 10} h` : "—"}
      />
      <Stat
        label="Absolviert"
        value={actual.length ? `${actual.length} · ${Math.round((actualMin / 60) * 10) / 10} h` : "—"}
      />
      <Stat label="Load" value={actualLoad > 0 ? String(Math.round(actualLoad)) : "—"} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-50 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="text-sm font-medium text-neutral-800">{value}</div>
    </div>
  );
}

function fmtDistance(sport: string, km: number): string {
  return sport === "swim" ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/** Detailkarte einer Einheit – zeigt möglichst alle verfügbaren Kennzahlen. */
function DetailRow({
  item,
  ftp,
  date,
  weightKg,
}: {
  item: CalendarItem;
  ftp: number;
  date: string;
  weightKg: number | null;
}) {
  const color = sportColor(item.sport);
  const stats: { label: string; value: string }[] = [];

  stats.push({ label: "Sport", value: sportLabel(item.sport) });
  if (item.durationMin > 0) {
    stats.push({ label: "Dauer", value: fmtDuration(item.durationMin) });
  }
  if (item.distanceKm != null && item.distanceKm > 0) {
    stats.push({ label: "Distanz", value: fmtDistance(item.sport, item.distanceKm) });
    const pace = derivePace(item.sport, item.durationMin, item.distanceKm);
    if (pace) stats.push({ label: "Tempo", value: pace });
  }

  // Geplante Einheit: aus dem Profil abgeleitete Eckwerte.
  let profileSummary: ReturnType<typeof summarizeProfile> | null = null;
  if (item.kind === "planned" && item.segments && item.segments.length > 0) {
    const bars = buildWorkoutProfile(item.segments, { ftp });
    profileSummary = summarizeProfile(bars, ftp);
  }

  if (item.kind === "actual") {
    if (item.avgPower != null && item.avgPower > 0) {
      stats.push({ label: "Ø Leistung", value: `${item.avgPower} W` });
      if (item.durationMin > 0) {
        stats.push({
          label: "Arbeit",
          value: `${Math.round((item.avgPower * item.durationMin * 60) / 1000)} kJ`,
        });
      }
    }
    if (item.avgHr != null && item.avgHr > 0) {
      stats.push({ label: "Ø Puls", value: `${item.avgHr} bpm` });
    }
    if (item.load != null && item.load > 0) {
      stats.push({ label: "Load", value: String(Math.round(item.load)) });
    }
    if (item.rpe != null && item.rpe > 0) {
      stats.push({ label: "RPE", value: String(item.rpe) });
    }
  } else {
    if (item.rpe != null && item.rpe > 0) {
      stats.push({ label: "Ziel-RPE", value: String(item.rpe) });
    }
    if (profileSummary && profileSummary.tss > 0) {
      stats.push({ label: "TSS (≈)", value: String(profileSummary.tss) });
      stats.push({ label: "IF (≈)", value: profileSummary.intensityFactor.toFixed(2) });
    }
    const hasKjStat =
      profileSummary != null &&
      profileSummary.kJ > 0 &&
      (item.sport === "bike" || item.sport === "brick");
    if (hasKjStat) {
      stats.push({ label: "Arbeit (≈)", value: `${profileSummary!.kJ} kJ` });
    }
    if (item.segments && item.segments.length > 0) {
      stats.push({ label: "Segmente", value: String(item.segments.length) });
    }
    if (!hasKjStat) {
      const energyForecast = forecastWorkoutEnergy(
        { date, sport: item.sport, plannedDurationMin: item.durationMin, segments: item.segments },
        { ftpWatts: ftp, weightKg },
      );
      if (energyForecast) {
        stats.push({
          label: `Energie (≈, ${FORECAST_CONFIDENCE_LABEL[energyForecast.confidence]})`,
          value: `${energyForecast.kcal} kcal`,
        });
      }
    }
  }

  const sourceLabel =
    item.kind === "actual" && item.source
      ? SOURCE_LABEL[item.source] ?? item.source
      : null;

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
        ) : sourceLabel ? (
          <span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
            {sourceLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {stats.map((s, i) => (
          <Stat key={i} label={s.label} value={s.value} />
        ))}
      </div>

      {item.description ? (
        <p className="mt-2 text-xs text-neutral-500">{item.description}</p>
      ) : null}

      {item.kind === "actual" && item.notes ? (
        <p className="mt-2 rounded-lg bg-neutral-50 px-2 py-1.5 text-xs italic text-neutral-500">
          {item.notes}
        </p>
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
