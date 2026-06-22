import { describe, it, expect } from "vitest";
import {
  stabilize,
  INITIAL_STABILIZER_STATE,
  DEFAULT_STABILIZER_OPTIONS,
  type StabilizerState,
} from "@/domain/barcode/stabilizer";

describe("stabilize", () => {
  it("akzeptiert einen Code erst nach requiredHits gleichen Treffern", () => {
    let state: StabilizerState = INITIAL_STABILIZER_STATE;
    const now = 1000;

    const r1 = stabilize(state, "4006381333634", now);
    expect(r1.accepted).toBeNull();
    state = r1.state;

    const r2 = stabilize(state, "4006381333634", now + 100);
    expect(r2.accepted).toBeNull();
    state = r2.state;

    const r3 = stabilize(state, "4006381333634", now + 200);
    expect(r3.accepted).toBe("4006381333634");
  });

  it("verwirft einen einzelnen Fehl-Read und startet die Zählung beim nächsten Code neu", () => {
    let state: StabilizerState = INITIAL_STABILIZER_STATE;
    const now = 1000;

    state = stabilize(state, "1111111111111", now).state;
    state = stabilize(state, "1111111111111", now + 50).state;
    // Ein zufälliger Fehl-Read mit anderem Code unterbricht die Serie.
    const misread = stabilize(state, "9999999999999", now + 80);
    expect(misread.accepted).toBeNull();
    expect(misread.state.hits).toBe(1);
  });

  it("setzt die Zählung zurück, wenn das Zeitfenster überschritten wird", () => {
    let state: StabilizerState = INITIAL_STABILIZER_STATE;
    const now = 1000;
    state = stabilize(state, "1111111111111", now).state;
    state = stabilize(state, "1111111111111", now + 100).state;

    const afterGap = stabilize(state, "1111111111111", now + 100 + DEFAULT_STABILIZER_OPTIONS.windowMs + 1);
    expect(afterGap.accepted).toBeNull();
    expect(afterGap.state.hits).toBe(1);
  });

  it("respektiert benutzerdefinierte Optionen (z.B. nur 2 Treffer nötig)", () => {
    let state: StabilizerState = INITIAL_STABILIZER_STATE;
    const options = { requiredHits: 2, windowMs: 1000 };
    const now = 0;

    state = stabilize(state, "12345678", now, options).state;
    const result = stabilize(state, "12345678", now + 10, options);
    expect(result.accepted).toBe("12345678");
  });
});
