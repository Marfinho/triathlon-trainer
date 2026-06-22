import { describe, it, expect } from "vitest";
import {
  buildWorkoutProfile,
  segmentTypeLabel,
  zoneColorForPct,
  summarizeProfile,
  type ProfileSegmentInput,
} from "@/domain/training/workoutProfile";

describe("zoneColorForPct", () => {
  it("ordnet Intensitäten Zonenfarben zu", () => {
    expect(zoneColorForPct(0.5)).toBe("#8e8e93");
    expect(zoneColorForPct(0.65)).toBe("#0a84ff");
    expect(zoneColorForPct(0.95)).toBe("#34c759");
    expect(zoneColorForPct(1.3)).toBe("#ff3b30");
  });
});

describe("segmentTypeLabel", () => {
  it("übersetzt bekannte Typen, Fallback Segment", () => {
    expect(segmentTypeLabel("warmup")).toBe("Aufwärmen");
    expect(segmentTypeLabel("threshold")).toBe("Schwelle");
    expect(segmentTypeLabel("unknown")).toBe("Segment");
    expect(segmentTypeLabel(null)).toBe("Segment");
  });
});

describe("buildWorkoutProfile", () => {
  const segments: ProfileSegmentInput[] = [
    { type: "warmup", durationSec: 600, intensity: "warmup" },
    { type: "threshold", durationSec: 1200, targetType: "power", targetValue: 240 },
    { type: "recovery", durationSec: 300, intensity: "recovery" },
  ];

  it("löst Power-Targets direkt zu Watt und %FTP auf", () => {
    const bars = buildWorkoutProfile(segments, { ftp: 240 });
    expect(bars[1].watts).toBe(240);
    expect(bars[1].pctFtp).toBe(1);
    expect(bars[1].color).toBe("#34c759");
  });

  it("nutzt die Dauer als Balkenbreite", () => {
    const bars = buildWorkoutProfile(segments, { ftp: 240 });
    expect(bars.map((b) => b.weight)).toEqual([600, 1200, 300]);
  });

  it("leitet aus der Zone einen FTP-Anteil ab", () => {
    const bars = buildWorkoutProfile(segments, { ftp: 200 });
    // warmup-Zone = 0.55 * 200 = 110 W
    expect(bars[0].watts).toBe(110);
    expect(bars[0].label).toBe("Aufwärmen");
  });

  it("fällt ohne Dauer auf Distanz bzw. Default zurück", () => {
    const bars = buildWorkoutProfile(
      [
        { type: "steady", distanceM: 2000, intensity: "endurance" },
        { type: "steady", intensity: "endurance" },
      ],
      { ftp: 200 },
    );
    expect(bars[0].weight).toBe(2000);
    expect(bars[1].weight).toBe(60);
  });
});

describe("summarizeProfile", () => {
  it("berechnet Dauer, IF, TSS und kJ aus dem Profil", () => {
    const ftp = 200;
    const bars = buildWorkoutProfile(
      [
        { type: "steady", durationSec: 3600, targetType: "power", targetValue: 200 },
      ],
      { ftp },
    );
    const s = summarizeProfile(bars, ftp);
    expect(s.totalSec).toBe(3600);
    expect(s.intensityFactor).toBe(1); // 200 W bei 200 FTP
    expect(s.tss).toBe(100); // 1 h bei IF 1.0
    expect(s.kJ).toBe(720); // 200 W * 3600 s / 1000
  });

  it("ignoriert Segmente ohne Dauer bei Zeit/TSS", () => {
    const bars = buildWorkoutProfile(
      [{ type: "steady", distanceM: 1000, intensity: "endurance" }],
      { ftp: 200 },
    );
    const s = summarizeProfile(bars, 200);
    expect(s.totalSec).toBe(0);
    expect(s.tss).toBe(0);
    expect(s.intensityFactor).toBe(0);
  });
});
