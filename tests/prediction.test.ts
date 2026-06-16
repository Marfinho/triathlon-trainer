import { describe, it, expect } from "vitest";
import {
  predictRunTime,
  predictBikeTime,
  predictSwimTime,
  predictTriathlon,
  formatDuration,
  matchRacePrediction,
  TRI_DISTANCES,
} from "@/domain/training/prediction";

describe("predictRunTime (Riegel)", () => {
  it("entspricht bei ~1h-Distanz der Schwellenleistung", () => {
    // Schwelle 4:00/km (240 s) -> 15 km in 1 h. 15 km Vorhersage ≈ 3600 s.
    expect(predictRunTime(15, 240)).toBeCloseTo(3600, -1);
  });
  it("kürzere Distanz = schneller, längere = langsamer (pro km)", () => {
    const t10 = predictRunTime(10, 240) / 10;
    const tM = predictRunTime(42.195, 240) / 42.195;
    expect(t10).toBeLessThan(240); // schneller als Schwelle
    expect(tM).toBeGreaterThan(240); // langsamer als Schwelle
  });
});

describe("predictBikeTime", () => {
  it("liefert plausible 40-km-Zeit für FTP 250", () => {
    const sec = predictBikeTime(40, 250, 0.85);
    expect(sec).toBeGreaterThan(3600); // > 60 min
    expect(sec).toBeLessThan(4500); // < 75 min
  });
  it("mehr Leistung -> schneller", () => {
    expect(predictBikeTime(40, 300, 0.85)).toBeLessThan(
      predictBikeTime(40, 250, 0.85),
    );
  });
});

describe("predictSwimTime", () => {
  it("1500 m bei CSS 90 s/100m ≈ 22:30", () => {
    expect(predictSwimTime(1500, 90, 1.0)).toBe(1350);
  });
});

describe("predictTriathlon", () => {
  const profile = {
    thresholdPaceSecPerKm: 255,
    ftpWatts: 240,
    cssPer100m: 95,
    ctl: 60,
  };

  it("summiert Legs + Transitions bei vollständigem Profil", () => {
    const oly = TRI_DISTANCES.find((t) => t.key === "olympic")!;
    const p = predictTriathlon(oly, profile);
    expect(p.confidence).toBe(1);
    expect(p.totalSec).toBe(
      (p.swimSec ?? 0) + (p.bikeSec ?? 0) + (p.runSec ?? 0) + p.transitionSec,
    );
  });

  it("liefert null-Total und geringere Confidence bei fehlenden Daten", () => {
    const oly = TRI_DISTANCES.find((t) => t.key === "olympic")!;
    const p = predictTriathlon(oly, { ...profile, ftpWatts: null });
    expect(p.bikeSec).toBeNull();
    expect(p.totalSec).toBeNull();
    expect(p.confidence).toBeCloseTo(2 / 3, 2);
  });
});

describe("formatDuration & matchRacePrediction", () => {
  it("formatiert Stunden/Minuten/Sekunden", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(125)).toBe("2:05");
    expect(formatDuration(null)).toBe("—");
  });

  it("ordnet Renn-Distanz einer Vorhersage zu", () => {
    const profile = { thresholdPaceSecPerKm: 255, ftpWatts: 240, cssPer100m: 95 };
    expect(matchRacePrediction("triathlon", "olympic", profile)?.totalSec).toBeGreaterThan(0);
    expect(matchRacePrediction("run", "10k", profile)?.label).toBe("10 km");
    expect(matchRacePrediction("run", "unbekannt", profile)).toBeNull();
  });
});
