import { describe, it, expect } from "vitest";
import { computeDailyBalance } from "@/domain/nutrition/dailyBalance";

describe("computeDailyBalance", () => {
  it("liefert status 'unknown' ohne gesetztes Ziel", () => {
    const result = computeDailyBalance({ intakeKcal: 2000, burnedKcal: 500, targetKcal: null });
    expect(result.status).toBe("unknown");
    expect(result.deltaToTargetKcal).toBeNull();
    expect(result.netKcal).toBe(1500);
  });

  it("liefert 'ok' innerhalb der ±300 kcal-Schwelle", () => {
    const result = computeDailyBalance({ intakeKcal: 2200, burnedKcal: 500, targetKcal: 1800 });
    // net = 1700, delta = -100 -> innerhalb der Schwelle
    expect(result.status).toBe("ok");
  });

  it("liefert 'underfueled' deutlich unter dem Ziel", () => {
    const result = computeDailyBalance({ intakeKcal: 1200, burnedKcal: 500, targetKcal: 1800 });
    // net = 700, delta = -1100
    expect(result.status).toBe("underfueled");
  });

  it("liefert 'surplus' deutlich über dem Ziel", () => {
    const result = computeDailyBalance({ intakeKcal: 3000, burnedKcal: 200, targetKcal: 1800 });
    // net = 2800, delta = +1000
    expect(result.status).toBe("surplus");
  });

  it("behandelt die Schwellenwerte als noch 'ok' (Grenzfall)", () => {
    const result = computeDailyBalance({ intakeKcal: 2100, burnedKcal: 0, targetKcal: 1800 });
    // delta genau 300 -> nicht > 300
    expect(result.status).toBe("ok");
  });
});
