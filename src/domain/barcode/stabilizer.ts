export interface StabilizerOptions {
  /** Anzahl gleicher Treffer in Folge, bevor ein Code akzeptiert wird. */
  requiredHits: number;
  /** Zeitfenster (ms): liegt der letzte Treffer länger zurück, beginnt die Zählung neu. */
  windowMs: number;
}

export interface StabilizerState {
  code: string | null;
  hits: number;
  lastSeenAt: number;
}

export interface StabilizerResult {
  state: StabilizerState;
  /** Gesetzt, sobald `requiredHits` erreicht ist – der Aufrufer feuert dann genau einmal `onDetected`. */
  accepted: string | null;
}

export const DEFAULT_STABILIZER_OPTIONS: StabilizerOptions = {
  requiredHits: 3,
  windowMs: 1500,
};

export const INITIAL_STABILIZER_STATE: StabilizerState = {
  code: null,
  hits: 0,
  lastSeenAt: 0,
};

/**
 * Reine Reducer-Funktion: verhindert, dass ein einzelner Fehl-Read aus dem
 * Kamerastream sofort als Treffer übernommen wird. Erst wenn derselbe Code
 * `requiredHits`-mal innerhalb von `windowMs` erkannt wurde, gilt er als
 * stabil. Kein interner Zustand – der Aufrufer hält `state` selbst.
 */
export function stabilize(
  state: StabilizerState,
  code: string,
  now: number,
  options: StabilizerOptions = DEFAULT_STABILIZER_OPTIONS,
): StabilizerResult {
  const continuesRun = state.code === code && now - state.lastSeenAt <= options.windowMs;
  const hits = continuesRun ? state.hits + 1 : 1;
  const nextState: StabilizerState = { code, hits, lastSeenAt: now };

  if (hits >= options.requiredHits) {
    return { state: nextState, accepted: code };
  }
  return { state: nextState, accepted: null };
}
