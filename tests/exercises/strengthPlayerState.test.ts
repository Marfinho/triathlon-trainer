import { describe, it, expect } from "vitest";
import {
  initialPlayerState,
  playerReducer,
  type PlayerAction,
  type PlayerStepMeta,
} from "@/components/exercises/strengthPlayerState";

const reps: PlayerStepMeta = { kind: "exercise", sets: 2, reps: 8, holdSec: null, restSec: 30, perSide: true };
const hold: PlayerStepMeta = { kind: "exercise", sets: 2, reps: null, holdSec: 20, restSec: 0, perSide: true };
const text: PlayerStepMeta = { kind: "text", sets: 0, reps: null, holdSec: null, restSec: 0, perSide: false };
const steps = [reps, hold, text];

function run(actions: PlayerAction[]) {
  return actions.reduce((s, a) => playerReducer(steps, s, a), initialPlayerState(steps));
}

describe("Kraft-Player – Ablauf", () => {
  it("Wiederholungen: Satz erledigt → Pause → nächster Satz → fertig", () => {
    let s = run([{ type: "completeSet" }]);
    expect(s).toMatchObject({ phase: "rest", countdownSec: 30, set: 1 });
    s = playerReducer(steps, s, { type: "timerEnd" });
    expect(s).toMatchObject({ phase: "ready", set: 2 });
    s = playerReducer(steps, s, { type: "completeSet" });
    expect(s.phase).toBe("stepDone");
  });

  it("Pause lässt sich überspringen", () => {
    const s = run([{ type: "completeSet" }, { type: "skipRest" }]);
    expect(s).toMatchObject({ phase: "ready", set: 2 });
  });

  it("Halten pro Seite: zwei Countdowns je Satz, ohne Pause direkt weiter", () => {
    let s = run([{ type: "next" }]);
    expect(s).toMatchObject({ index: 1, phase: "ready", side: 1 });
    s = playerReducer(steps, s, { type: "startHold" });
    expect(s).toMatchObject({ phase: "hold", countdownSec: 20 });
    s = playerReducer(steps, s, { type: "timerEnd" });
    expect(s).toMatchObject({ phase: "ready", side: 2, set: 1 });
    s = playerReducer(steps, s, { type: "startHold" });
    s = playerReducer(steps, s, { type: "timerEnd" });
    expect(s).toMatchObject({ phase: "ready", side: 1, set: 2 });
  });

  it("Textschritte sind sofort erledigt, am Ende ist die Einheit beendet", () => {
    let s = run([{ type: "goto", index: 2 }]);
    expect(s.phase).toBe("stepDone");
    s = playerReducer(steps, s, { type: "next" });
    expect(s.finished).toBe(true);
  });

  it("Zurück setzt den Schritt neu auf und bleibt im Bereich", () => {
    const s = run([{ type: "completeSet" }, { type: "prev" }]);
    expect(s).toMatchObject({ index: 0, set: 1, phase: "ready" });
  });

  it("ignoriert unpassende Aktionen", () => {
    const s0 = initialPlayerState(steps);
    expect(playerReducer(steps, s0, { type: "startHold" })).toBe(s0);
    expect(playerReducer(steps, s0, { type: "skipRest" })).toBe(s0);
  });
});
