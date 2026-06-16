import { Card, sportLabel, sportColor } from "./Card";
import type { CalendarDay } from "@/domain/training/calendar";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function TrainingCalendar({ grid }: { grid: CalendarDay[][] }) {
  return (
    <Card
      title="Trainingskalender"
      subtitle="Geplante Einheiten (Umriss) und Ist-Aktivitäten (gefüllt)"
    >
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-neutral-400">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1">
            {d}
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {grid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day) => (
              <DayCell key={day.date} day={day} />
            ))}
          </div>
        ))}
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
