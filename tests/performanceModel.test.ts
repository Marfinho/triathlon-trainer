import { describe, it, expect } from "vitest";
import {
  buildPerformanceModel,
  forecastRace,
  forecastRunDistances,
  forecastTriathlons,
  parseRunDistanceKm,
  resolveThresholdHr,
  type PerfActivity,
} from "@/domain/training/performanceModel";

const today = new Date("2026-09-30T12:00:00Z");
const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000);

/**
 * Athlet mit echter Schwelle ~4:30/km (≈3,7 m/s) bei LTHR 170.
 * Lockere Läufe bei ~78 % LTHR / RPE 3, Schwellenläufe bei ~97 % / RPE 7.
 */
function runBlock(): PerfActivity[] {
  const acts: PerfActivity[] = [];
  for (let w = 0; w < 12; w++) {
    acts.push({ date: daysAgo(w * 7 + 1), sport: "run", distanceKm: 10, durationMin: 55, avgHr: 138, avgPower: null, rpe: 3 });
    acts.push({ date: daysAgo(w * 7 + 3), sport: "run", distanceKm: 10, durationMin: 46, avgHr: 164, avgPower: null, rpe: 7 });
    acts.push({ date: daysAgo(w * 7 + 5), sport: "run", distanceKm: 18, durationMin: 100, avgHr: 145, avgPower: null, rpe: 4 });
  }
  return acts;
}

describe("buildPerformanceModel – Laufen", () => {
  it("schätzt die Schwelle aus HF/RPE statt aus der Profil-Schwellenpace", () => {
    const model = buildPerformanceModel({
      activities: runBlock(),
      thresholdHr: 170,
      thresholdPaceSecPerKm: 330, // veralteter, viel zu langsamer Profilwert (5:30/km)
      today,
    });
    const pace = 1000 / model.run!.value;
    // Daten zeigen ~4:25–4:45/km – der Profilwert darf das nicht dominieren.
    expect(pace).toBeGreaterThan(255);
    expect(pace).toBeLessThan(290);
    expect(model.run!.sources.find((s) => s.kind === "profile")!.share).toBeLessThan(0.2);
  });

  it("liefert einen Korridor fast < likely < slow mit plausibler 10-km-Zeit", () => {
    const model = buildPerformanceModel({ activities: runBlock(), thresholdHr: 170, today });
    const tenK = forecastRunDistances(model.run!).find((f) => f.key === "10k")!;
    expect(tenK.corridor.fastSec).toBeLessThan(tenK.corridor.likelySec);
    expect(tenK.corridor.likelySec).toBeLessThan(tenK.corridor.slowSec);
    expect(tenK.corridor.likelySec).toBeGreaterThan(40 * 60);
    expect(tenK.corridor.likelySec).toBeLessThan(47 * 60);
    // Korridorbreite realistisch: nicht Punktwert, aber auch nicht beliebig.
    const width = (tenK.corridor.slowSec - tenK.corridor.fastSec) / tenK.corridor.likelySec;
    expect(width).toBeGreaterThan(0.03);
    expect(width).toBeLessThan(0.2);
  });

  it("gewichtet ein Wettkampfergebnis stark", () => {
    const base = buildPerformanceModel({ activities: runBlock(), thresholdHr: 170, today });
    const withRace = buildPerformanceModel({
      activities: runBlock(),
      thresholdHr: 170,
      races: [{ date: daysAgo(20), type: "run", distance: "10k", resultSeconds: 40 * 60, completed: true }],
      today,
    });
    expect(withRace.run!.value).toBeGreaterThan(base.run!.value);
    expect(withRace.run!.sources.some((s) => s.kind === "race")).toBe(true);
  });

  it("Höhenmeter machen einen Lauf wertvoller (höhenbereinigt)", () => {
    const flat = buildPerformanceModel({
      activities: [{ date: daysAgo(2), sport: "run", distanceKm: 10, durationMin: 50, avgHr: 160, avgPower: null, rpe: 7 }],
      thresholdHr: 170,
      today,
    });
    const hilly = buildPerformanceModel({
      activities: [{ date: daysAgo(2), sport: "run", distanceKm: 10, durationMin: 50, avgHr: 160, avgPower: null, rpe: 7, elevationGainM: 250 }],
      thresholdHr: 170,
      today,
    });
    expect(hilly.run!.value).toBeGreaterThan(flat.run!.value);
  });

  it("Marathon ohne lange Läufe bekommt einen Ausdauer-Abschlag", () => {
    const shortOnly = runBlock().map((a) => ({ ...a, distanceKm: 10, durationMin: a.durationMin! > 60 ? 50 : a.durationMin }));
    const model = buildPerformanceModel({ activities: shortOnly, thresholdHr: 170, today });
    const m = forecastRunDistances(model.run!).find((f) => f.key === "m")!;
    expect(m.notes.join(" ")).toMatch(/Ausdauer-Abschlag/);
  });

  it("ohne Daten gibt es kein Modell, nur mit Profil eine unsichere Schätzung", () => {
    expect(buildPerformanceModel({ activities: [], today }).run).toBeNull();
    const m = buildPerformanceModel({ activities: [], thresholdPaceSecPerKm: 270, today });
    expect(1000 / m.run!.value).toBeCloseTo(270, 0);
    expect(forecastRunDistances(m.run!)[1].confidence).toBe("niedrig");
  });

  it("ignoriert sehr alte Einheiten", () => {
    const old = runBlock().map((a) => ({ ...a, date: daysAgo(400) }));
    expect(buildPerformanceModel({ activities: old, thresholdHr: 170, today }).run).toBeNull();
  });
});

describe("buildPerformanceModel – Rad & Schwimmen & Triathlon", () => {
  const acts: PerfActivity[] = [
    ...runBlock(),
    ...Array.from({ length: 10 }, (_, i) => ({
      date: daysAgo(i * 7 + 2), sport: "bike", distanceKm: 60, durationMin: 120, avgHr: 140, avgPower: 180, rpe: 5, elevationGainM: 300,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      date: daysAgo(i * 7 + 4), sport: "bike", distanceKm: 35, durationMin: 60, avgHr: 158, avgPower: 230, rpe: 8, elevationGainM: 100,
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      date: daysAgo(i * 7 + 6), sport: "swim", distanceKm: 2.5, durationMin: 50, avgHr: null, avgPower: null, rpe: 5,
    })),
  ];

  it("schätzt FTP aus Leistung/HF/RPE im plausiblen Bereich", () => {
    const model = buildPerformanceModel({ activities: acts, thresholdHr: 170, today });
    expect(model.bike!.mode).toBe("power");
    expect(model.bike!.value).toBeGreaterThan(220);
    expect(model.bike!.value).toBeLessThan(290);
  });

  it("liefert vollständige Triathlon-Korridore", () => {
    const model = buildPerformanceModel({ activities: acts, thresholdHr: 170, today });
    const oly = forecastTriathlons(model).find((t) => t.key === "olympic")!;
    expect(oly.total).not.toBeNull();
    expect(oly.total!.fastSec).toBeLessThan(oly.total!.likelySec);
    expect(oly.total!.slowSec).toBeGreaterThan(oly.total!.likelySec);
    expect(oly.total!.likelySec).toBeGreaterThan(2 * 3600);
    expect(oly.total!.likelySec).toBeLessThan(3 * 3600);
    expect(oly.bikeTarget!.watts).toBeGreaterThan(0);
  });

  it("Rad ohne Leistungsmesser nutzt Geschwindigkeit", () => {
    const noPower = acts.map((a) => ({ ...a, avgPower: null }));
    const model = buildPerformanceModel({ activities: noPower, thresholdHr: 170, today });
    expect(model.bike!.mode).toBe("speed");
    expect(model.bike!.value).toBeGreaterThan(25);
    expect(model.bike!.value).toBeLessThan(45);
  });

  it("forecastRace ordnet geplante Rennen zu", () => {
    const model = buildPerformanceModel({ activities: acts, thresholdHr: 170, today });
    expect(forecastRace("triathlon", "70.3", model)?.label).toBe("Mitteldistanz (70.3)");
    expect(forecastRace("run", "Halbmarathon", model)?.label).toBe("Halbmarathon");
    expect(forecastRace("run", "15 km", model)?.label).toBe("15 km");
    expect(forecastRace("run", "irgendwas", model)).toBeNull();
    expect(forecastRace("triathlon", "", model)).toBeNull();
  });
});

describe("Hilfsfunktionen", () => {
  it("parseRunDistanceKm", () => {
    expect(parseRunDistanceKm("10k")).toBe(10);
    expect(parseRunDistanceKm("Halbmarathon")).toBeCloseTo(21.0975);
    expect(parseRunDistanceKm("12,5 km")).toBe(12.5);
    expect(parseRunDistanceKm(null)).toBeNull();
  });

  it("resolveThresholdHr schätzt LTHR aus Max-HF, wenn kein Profilwert", () => {
    const acts: PerfActivity[] = [
      { date: daysAgo(5), sport: "run", distanceKm: 5, durationMin: 20, avgHr: 175, maxHr: 190, avgPower: null, rpe: null },
    ];
    expect(resolveThresholdHr(acts, null, today)).toEqual({ lthr: 171, estimated: true });
    expect(resolveThresholdHr(acts, 168, today)).toEqual({ lthr: 168, estimated: false });
  });
});
