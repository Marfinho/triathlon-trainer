import { describe, it, expect } from "vitest";
import { buildCalendar } from "@/domain/training/calendar";

const today = new Date("2026-06-17T00:00:00Z"); // Mittwoch

describe("buildCalendar", () => {
  it("baut ein Mo–So-Gitter mit der gewünschten Wochenzahl", () => {
    const grid = buildCalendar([], [], { weeks: 3, weeksBefore: 1, today });
    expect(grid).toHaveLength(3);
    expect(grid[0]).toHaveLength(7);
    // erste Woche beginnt am Montag der Vorwoche (08.06.2026)
    expect(grid[0][0].date).toBe("2026-06-08");
  });

  it("ordnet geplante und Ist-Einheiten dem richtigen Tag zu", () => {
    const grid = buildCalendar(
      [
        { date: "2026-06-17", sport: "bike", title: "GA1", plannedDurationMin: 90, status: "planned" },
        { date: "2026-06-16", sport: "run", title: "Alt", plannedDurationMin: 60, status: "replaced" },
      ],
      [{ date: "2026-06-17", sport: "bike", durationMin: 88 }],
      { weeks: 3, weeksBefore: 1, today },
    );
    const allDays = grid.flat();
    const wed = allDays.find((d) => d.date === "2026-06-17")!;
    expect(wed.isToday).toBe(true);
    expect(wed.items).toHaveLength(2); // planned + actual
    // replaced wird ignoriert
    const tue = allDays.find((d) => d.date === "2026-06-16")!;
    expect(tue.items).toHaveLength(0);
  });

  it("markiert vergangene Tage", () => {
    const grid = buildCalendar([], [], { weeks: 2, weeksBefore: 1, today });
    const past = grid.flat().find((d) => d.date === "2026-06-10")!;
    expect(past.inPast).toBe(true);
  });
});
