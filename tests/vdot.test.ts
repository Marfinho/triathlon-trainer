import { describe, it, expect } from "vitest";
import { estimateVdot, vdotCategory } from "@/domain/training/vdot";

describe("estimateVdot", () => {
  it("schätzt einen plausiblen VDOT für 5 km in 20:00", () => {
    const r = estimateVdot(5000, 20 * 60)!;
    // Daniels: 5k in 20:00 entspricht ~VDOT 49–50.
    expect(r.vdot).toBeGreaterThan(46);
    expect(r.vdot).toBeLessThan(53);
    expect(r.vo2max).toBe(r.vdot);
  });

  it("liefert höheren VDOT für schnellere Zeit", () => {
    const slow = estimateVdot(5000, 25 * 60)!;
    const fast = estimateVdot(5000, 18 * 60)!;
    expect(fast.vdot).toBeGreaterThan(slow.vdot);
  });

  it("liefert null bei ungültigen Eingaben", () => {
    expect(estimateVdot(0, 1200)).toBeNull();
    expect(estimateVdot(5000, 0)).toBeNull();
  });
});

describe("vdotCategory", () => {
  it("kategorisiert nach Niveau", () => {
    expect(vdotCategory(30)).toBe("Einsteiger");
    expect(vdotCategory(50)).toBe("fortgeschritten");
    expect(vdotCategory(70)).toBe("Elite");
  });
});
