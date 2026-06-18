import { describe, it, expect } from "vitest";
import { activitiesToCsv, type CsvActivity } from "@/domain/export/csv";

function act(o: Partial<CsvActivity>): CsvActivity {
  return {
    date: "2026-06-01",
    sport: "run",
    durationMin: 60,
    distanceKm: 10,
    load: 60,
    rpe: 4,
    avgHr: 140,
    avgPower: null,
    source: "manual",
    ...o,
  };
}

describe("activitiesToCsv", () => {
  it("schreibt Header + Datenzeilen mit CRLF", () => {
    const csv = activitiesToCsv([act({})]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("date,sport,duration_min,distance_km,load,rpe,avg_hr,avg_power,source");
    expect(lines[1]).toBe("2026-06-01,run,60,10,60,4,140,,manual");
  });

  it("lässt null-Felder leer", () => {
    const csv = activitiesToCsv([act({ load: null, rpe: null, avgHr: null })]);
    expect(csv.split("\r\n")[1]).toContain("2026-06-01,run,60,10,,,,,manual");
  });

  it("quotet Felder mit Sonderzeichen", () => {
    const csv = activitiesToCsv([act({ sport: 'trail, "long"' })]);
    expect(csv.split("\r\n")[1]).toContain('"trail, ""long"""');
  });

  it("formatiert Date-Objekte als ISO-Datum", () => {
    const csv = activitiesToCsv([act({ date: new Date("2026-06-01T10:00:00Z") })]);
    expect(csv.split("\r\n")[1].startsWith("2026-06-01")).toBe(true);
  });
});
