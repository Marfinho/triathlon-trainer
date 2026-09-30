/**
 * Ablauflogik des Kraft-Players (rein, ohne DOM/Timer – gut testbar).
 *
 * Pro Übungsschritt: Satz für Satz. Bei Halteübungen (`holdSec`) läuft ein
 * Countdown (bei `perSide` je Seite), bei Wiederholungen bestätigt man den
 * Satz. Zwischen den Sätzen läuft die Pause (`restSec`). Textschritte (ohne
 * Übung) haben keine Sätze.
 */

export interface PlayerStepMeta {
  kind: "exercise" | "text";
  sets: number;
  reps: number | null;
  holdSec: number | null;
  restSec: number;
  perSide: boolean;
}

export type PlayerPhase = "ready" | "hold" | "rest" | "stepDone";

export interface PlayerState {
  index: number;
  /** 1-basiert */
  set: number;
  side: 1 | 2;
  phase: PlayerPhase;
  /** Countdown-Dauer der aktuellen Phase in Sekunden (hold/rest) */
  countdownSec: number | null;
  finished: boolean;
}

export type PlayerAction =
  | { type: "startHold" }
  | { type: "completeSet" }
  | { type: "timerEnd" }
  | { type: "skipRest" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "goto"; index: number };

export function initialPlayerState(steps: PlayerStepMeta[], index = 0): PlayerState {
  const i = Math.min(Math.max(index, 0), Math.max(steps.length - 1, 0));
  return {
    index: i,
    set: 1,
    side: 1,
    phase: steps[i]?.kind === "text" ? "stepDone" : "ready",
    countdownSec: null,
    finished: steps.length === 0,
  };
}

function finishSet(state: PlayerState, step: PlayerStepMeta): PlayerState {
  if (state.set >= step.sets) {
    return { ...state, phase: "stepDone", countdownSec: null, side: 1 };
  }
  if (step.restSec > 0) {
    return { ...state, phase: "rest", countdownSec: step.restSec, side: 1 };
  }
  return { ...state, set: state.set + 1, side: 1, phase: "ready", countdownSec: null };
}

export function playerReducer(
  steps: PlayerStepMeta[],
  state: PlayerState,
  action: PlayerAction,
): PlayerState {
  const step = steps[state.index];
  switch (action.type) {
    case "startHold":
      if (!step || step.kind !== "exercise" || step.holdSec == null || state.phase !== "ready")
        return state;
      return { ...state, phase: "hold", countdownSec: step.holdSec };
    case "completeSet":
      if (!step || step.kind !== "exercise" || state.phase !== "ready") return state;
      return finishSet(state, step);
    case "timerEnd":
      if (!step) return state;
      if (state.phase === "hold") {
        if (step.perSide && state.side === 1) {
          return { ...state, side: 2, phase: "ready", countdownSec: null };
        }
        return finishSet(state, step);
      }
      if (state.phase === "rest") {
        return { ...state, set: state.set + 1, side: 1, phase: "ready", countdownSec: null };
      }
      return state;
    case "skipRest":
      if (state.phase !== "rest") return state;
      return { ...state, set: state.set + 1, side: 1, phase: "ready", countdownSec: null };
    case "next":
      if (state.index >= steps.length - 1) return { ...state, finished: true, phase: "stepDone" };
      return initialPlayerState(steps, state.index + 1);
    case "prev":
      return initialPlayerState(steps, state.index - 1);
    case "goto":
      return initialPlayerState(steps, action.index);
  }
}
