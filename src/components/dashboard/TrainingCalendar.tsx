import { Card, sportLabel, sportColor } from "./Card";
import type { CalendarDay } from "@/domain/training/calendar";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function TrainingCalendar({ grid }: { grid: CalendarDay[][] }) {
  return (
    <Card
      title="Trainingskalender"
      subtitle="Geplante Einheiten (Umriss) und Ist-Aktivitäten (gefüllt)"
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
                  <DayCell key={day.date} day={day} />
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
    </Card>
  );
}

function DayCell({ day }: { day: CalendarDay }) {
  const dayNum = day.date.slice(8, 10);
  return (
    <div
      className={`min-h-[64px] rounded-lg border p-1.5 ${
        day.isToday
          ? "border-blue-400 bg-blue-50/40"
          : day.inPast
            ? "border-neutral-100 bg-neutral-50/40"
            : "border-neutral-200 bg-white"
      }`}
    >
      <div
        className={`mb-1 text-right text-[10px] ${
          day.isToday ? "font-semibold text-blue-600" : "text-neutral-400"
        }`}
      >
        {dayNum}
      </div>
      <div className="space-y-0.5">
        {day.items.slice(0, 3).map((it, i) => {
          const color = sportColor(it.sport);
          return (
            <div
              key={i}
              title={`${sportLabel(it.sport)} · ${it.label} · ${it.durationMin}′`}
              className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]"
              style={
                it.kind === "actual"
                  ? { backgroundColor: `${color}22`, color: "#1d1d1f" }
                  : { border: `1px solid ${color}55`, color: "#6e6e73" }
              }
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="truncate">{it.durationMin}′</span>
            </div>
          );
        })}
        {day.items.length > 3 ? (
          <div className="text-[10px] text-neutral-400">+{day.items.length - 3}</div>
        ) : null}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex items-center gap-4 text-[11px] text-neutral-500">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-neutral-300" /> geplant
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-neutral-200" /> erledigt
      </span>
    </div>
  );
}
