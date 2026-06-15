import { describe, it, expect } from "vitest";
import { resolveSegmentWatts } from "@/integrations/trainer/watts";
import {
  buildWorkoutTimeline,
  stepAt,
} from "@/integrations/trainer/workoutPlayer";

const FTP = 250;

describe("resolveSegmentWatts", () => {
  it("nutzt explizite Power-Targets direkt", () => {
    const r = resolveSegmentWatts(
      { targetType: "power", targetValue: 210 },
      { ftp: FTP },
    );
    expect(r.target).toBe(210);
    expect(r.source).toBe("power");
  });

  it("nutzt die Mitte eines Power-Bereichs und liefert range", () => {
    const r = resolveSegmentWatts(
      { targetType: "power", targetValue: 200, targetValueTo: 240 },
      { ftp: FTP },
    );
    expect(r.target).toBe(220);
    expect(r.range).toEqual([200, 240]);
  });

  it("leitet Watt aus der Zone (Intensität/Typ) ab", () => {
    expect(
      resolveSegmentWatts({ intensity: "threshold" }, { ftp: FTP }).target,
    ).toBe(Math.round(FTP * 0.95));
    expect(resolveSegmentWatts({ type: "endurance" }, { ftp: FTP }).target).toBe(
      Math.round(FTP * 0.65),
    );
  });

  it("leitet Watt aus dem RPE-Ziel ab, wenn keine Zone passt", () => {
    const r = resolveSegmentWatts({ rpeTarget: 7 }, { ftp: FTP });
    expect(r.target).toBe(Math.round(FTP * 0.95));
    expect(r.source).toBe("rpe");
  });

  it("fällt auf den Default zurück", () => {
    const r = resolveSegmentWatts({}, { ftp: FTP });
    expect(r.source).toBe("default");
    expect(r.target).toBe(Math.round(FTP * 0.6));
  });
});

describe("buildWorkoutTimeline + stepAt", () => {
  const segments = [
    { type: "warmup", durationSec: 600, intensity: "warmup" },
    { type: "interval", durationSec: 300, targetType: "power", targetValue: 280 },
    { type: "recovery", durationSec: 120, intensity: "recovery" },
    { type: "rest", durationSec: 60 },
    { type: "steady", durationSec: 0 }, // wird übersprungen
  ];

  it("baut eine Timeline mit kumulativen Zeiten und Watt", () => {
    const tl = buildWorkoutTimeline(segments, { ftp: FTP });
    expect(tl.steps).toHaveLength(4); // 0-Dauer-Segment übersprungen
    expect(tl.totalDurationSec).toBe(600 + 300 + 120 + 60);
    expect(tl.steps[0]).toMatchObject({ startSec: 0, endSec: 600 });
    expect(tl.steps[1].targetWatts).toBe(280); // Power-Target
    expect(tl.steps[3].targetWatts).toBe(0); // rest -> 0 W
  });

  it("findet den aktiven Schritt zu einer verstrichenen Zeit", () => {
    const tl = buildWorkoutTimeline(segments, { ftp: FTP });
    const at0 = stepAt(tl, 0);
    expect(at0.stepIndex).toBe(0);
    expect(at0.step?.targetWatts).toBe(Math.round(FTP * 0.55));

    const at650 = stepAt(tl, 650); // in das Intervall (600..900)
    expect(at650.stepIndex).toBe(1);
    expect(at650.secondsIntoStep).toBe(50);
    expect(at650.secondsRemainingInStep).toBe(250);

    const done = stepAt(tl, 99999);
    expect(done.isComplete).toBe(true);
    expect(done.step).toBeNull();
  });
});
