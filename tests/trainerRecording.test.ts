import { describe, it, expect } from "vitest";
import {
  summarizeRide,
  normalizedPower,
  downsample,
  type RideSample,
} from "@/integrations/trainer/recording";

function steadyRide(seconds: number, watts: number): RideSample[] {
  return Array.from({ length: seconds }, (_, i) => ({
    tSec: i,
    powerW: watts,
    cadenceRpm: 90,
    hrBpm: 150,
    speedKmh: 32,
  }));
}

describe("summarizeRide", () => {
  it("liefert leere Kennzahlen ohne Samples", () => {
    const s = summarizeRide([], { ftp: 250 });
    expect(s.durationSec).toBe(0);
    expect(s.avgPowerW).toBeNull();
    expect(s.tss).toBeNull();
  });

  it("berechnet Durchschnitt, Max und Dauer", () => {
    const s = summarizeRide(steadyRide(60, 200), { ftp: 250 });
    expect(s.durationSec).toBe(60);
    expect(s.avgPowerW).toBe(200);
    expect(s.maxPowerW).toBe(200);
    expect(s.avgCadenceRpm).toBe(90);
    expect(s.avgHrBpm).toBe(150);
  });

  it("NP entspricht bei konstanter Leistung der Durchschnittsleistung", () => {
    const s = summarizeRide(steadyRide(120, 250), { ftp: 250 });
    expect(s.normalizedPowerW).toBe(250);
    expect(s.intensityFactor).toBeCloseTo(1.0, 2);
  });

  it("TSS einer Stunde bei FTP ist ~100", () => {
    const s = summarizeRide(steadyRide(3600, 250), { ftp: 250 });
    expect(s.tss).toBe(100);
  });

  it("berechnet Arbeit (kJ): 250 W über 100 s = 25 kJ", () => {
    const s = summarizeRide(steadyRide(100, 250), { ftp: 250 });
    expect(s.kiloJoules).toBe(25);
  });

  it("schätzt Distanz aus der Geschwindigkeit", () => {
    // 36 km/h über 100 s = 1 km
    const samples = Array.from({ length: 100 }, (_, i) => ({
      tSec: i,
      powerW: 200,
      speedKmh: 36,
    }));
    expect(summarizeRide(samples, { ftp: 250 }).distanceKm).toBeCloseTo(1.0, 1);
  });

  it("ignoriert fehlende Cadence/HF-Werte beim Durchschnitt", () => {
    const samples: RideSample[] = [
      { tSec: 0, powerW: 200, cadenceRpm: 80, hrBpm: null },
      { tSec: 1, powerW: 220, cadenceRpm: null, hrBpm: 160 },
    ];
    const s = summarizeRide(samples, { ftp: 250 });
    expect(s.avgCadenceRpm).toBe(80);
    expect(s.avgHrBpm).toBe(160);
  });
});

describe("normalizedPower & downsample", () => {
  it("NP bei konstanter Leistung = Leistung", () => {
    expect(normalizedPower(Array(60).fill(200))).toBe(200);
  });

  it("downsample reduziert auf die gewünschte Punktzahl", () => {
    const arr = Array.from({ length: 1000 }, (_, i) => i);
    const ds = downsample(arr, 100);
    expect(ds.length).toBe(100);
    expect(ds[0]).toBe(0);
  });
});
