import { describe, it, expect } from "vitest";
import { buildTcx } from "@/domain/export/tcx";

describe("buildTcx", () => {
  const startTime = new Date("2026-06-01T08:00:00.000Z");

  it("baut ein valides TCX-Grundgerüst mit Sport-Mapping", () => {
    const xml = buildTcx({
      sport: "bike",
      startTime,
      samples: [{ tSec: 0, speedKmh: 36 }, { tSec: 1, speedKmh: 36 }],
    });
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<Activity Sport="Biking">');
    expect(xml).toContain(`<Id>${startTime.toISOString()}</Id>`);
    expect(xml).toContain("<TotalTimeSeconds>2</TotalTimeSeconds>");
  });

  it("mapped unbekannte Sportarten auf Other", () => {
    const xml = buildTcx({ sport: "swim", startTime, samples: [{ tSec: 0 }] });
    expect(xml).toContain('<Activity Sport="Other">');
  });

  it("mapped Laufen auf Running", () => {
    const xml = buildTcx({ sport: "run", startTime, samples: [{ tSec: 0 }] });
    expect(xml).toContain('<Activity Sport="Running">');
  });

  it("akkumuliert die Distanz aus der Geschwindigkeit (1 Sample ≈ 1 s)", () => {
    // 36 km/h = 10 m/s -> nach 2 Samples 20 m.
    const xml = buildTcx({
      sport: "bike",
      startTime,
      samples: [{ tSec: 0, speedKmh: 36 }, { tSec: 1, speedKmh: 36 }],
    });
    expect(xml).toContain("<DistanceMeters>20.0</DistanceMeters>");
  });

  it("lässt optionale Felder weg, wenn sie fehlen oder ungültig sind", () => {
    const xml = buildTcx({
      sport: "bike",
      startTime,
      samples: [{ tSec: 0, hrBpm: null, cadenceRpm: 0, powerW: undefined }],
    });
    expect(xml).not.toContain("<HeartRateBpm>");
    expect(xml).not.toContain("<Cadence>");
    expect(xml).not.toContain("<TPX");
  });

  it("inkludiert HF, Trittfrequenz und Power, wenn vorhanden", () => {
    const xml = buildTcx({
      sport: "bike",
      startTime,
      samples: [{ tSec: 0, hrBpm: 145, cadenceRpm: 90, powerW: 220 }],
    });
    expect(xml).toContain("<HeartRateBpm><Value>145</Value></HeartRateBpm>");
    expect(xml).toContain("<Cadence>90</Cadence>");
    expect(xml).toContain("<Watts>220</Watts>");
  });

  it("setzt die Trackpoint-Zeit relativ zur Startzeit (tSec)", () => {
    const xml = buildTcx({
      sport: "bike",
      startTime,
      samples: [{ tSec: 0 }, { tSec: 5 }],
    });
    expect(xml).toContain("<Time>2026-06-01T08:00:00.000Z</Time>");
    expect(xml).toContain("<Time>2026-06-01T08:00:05.000Z</Time>");
  });
});
