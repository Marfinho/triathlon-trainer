import { describe, it, expect } from "vitest";
import {
  computePowerZones,
  computeHrZones,
  computePaceZones,
  formatPace,
} from "@/domain/training/zones";
import { interpretAcwr } from "@/domain/training/trainingLoad";
import { trainingPhase } from "@/domain/training/races";

describe("computePowerZones", () => {
  it("berechnet Coggan-Zonen aus der FTP", () => {
    const z = computePowerZones(250);
    expect(z).toHaveLength(7);
    // Z4 Schwelle: 91–105 % von 250 = 228–263
    const z4 = z.find((x) => x.id === "z4")!;
    expect(z4.lo).toBe(228);
    expect(z4.hi).toBe(263);
    // Z7 ist nach oben offen
    expect(z.find((x) => x.id === "z7")!.hi).toBeNull();
  });
});

describe("computeHrZones", () => {
  it("berechnet HF-Zonen aus der Schwellen-HF", () => {
    const z = computeHrZones(170);
    expect(z).toHaveLength(5);
    expect(z.find((x) => x.id === "z4")!.lo).toBe(Math.round(170 * 0.94));
    expect(z.find((x) => x.id === "z5")!.hi).toBeNull();
  });
});

describe("computePaceZones & formatPace", () => {
  it("schnellere Zone hat kleinere Sekundenzahl", () => {
    const z = computePaceZones(300); // 5:00 /km Schwelle
    const z2 = z.find((x) => x.id === "z2")!;
    const z4 = z.find((x) => x.id === "z4")!;
    expect((z4.lo ?? 0)).toBeLessThan(z2.lo ?? 0);
  });
  it("formatiert Pace als m:ss", () => {
    expect(formatPace(300)).toBe("5:00");
    expect(formatPace(330)).toBe("5:30");
    expect(formatPace(null)).toBe("—");
  });
});

describe("interpretAcwr", () => {
  it("erkennt Sweet Spot und Risikobereiche", () => {
    expect(interpretAcwr(0.6).level).toBe("low");
    expect(interpretAcwr(1.0).level).toBe("ok");
    expect(interpretAcwr(1.4).level).toBe("high");
    expect(interpretAcwr(null).label).toBe("—");
  });
});

describe("trainingPhase", () => {
  it("leitet die Periodisierungsphase aus den Tagen bis zum Rennen ab", () => {
    expect(trainingPhase(120).phase).toBe("base");
    expect(trainingPhase(60).phase).toBe("build");
    expect(trainingPhase(20).phase).toBe("specific");
    expect(trainingPhase(5).phase).toBe("taper");
    expect(trainingPhase(0).phase).toBe("race");
    expect(trainingPhase(-2).phase).toBe("off");
  });
});
