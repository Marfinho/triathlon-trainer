"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { SegmentExercise } from "@/domain/exercises/schema";
import { isExercise3d, type AnyExerciseDefinition } from "@/domain/exercises/any";
import { formatExerciseDose } from "@/domain/exercises/duration";
import { ExerciseAnimation } from "./ExerciseAnimation";
import { Exercise3dViewer } from "./Exercise3dViewer";
import { ExercisePlaceholder } from "./ExerciseFigure";
import {
  initialPlayerState,
  playerReducer,
  type PlayerAction,
  type PlayerState,
  type PlayerStepMeta,
} from "./strengthPlayerState";

export type StrengthPlayerStep =
  | {
      kind: "exercise";
      exercise: SegmentExercise;
      definition: AnyExerciseDefinition | null;
      status: "ok" | "invalid" | "missing";
      description: string | null;
    }
  | { kind: "text"; description: string | null; segmentType: string; durationSec: number | null };

const SIGNAL_KEY = "localhub-player-signal";

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Kurzer Signalton (WebAudio) und Vibration – beides optional. */
function signal() {
  try {
    navigator.vibrate?.(200);
  } catch {
    // Vibration nicht verfügbar
  }
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => void ctx.close();
  } catch {
    // Audio nicht verfügbar
  }
}

function toMeta(step: StrengthPlayerStep): PlayerStepMeta {
  if (step.kind === "text") {
    return { kind: "text", sets: 0, reps: null, holdSec: null, restSec: 0, perSide: false };
  }
  const e = step.exercise;
  return {
    kind: "exercise",
    sets: e.sets,
    reps: e.reps,
    holdSec: e.reps == null ? e.holdSec : null,
    restSec: e.restSec ?? 0,
    perSide: e.perSide,
  };
}

/** Bildschirm während der Einheit anlassen (falls vom Browser unterstützt). */
function useWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> };
    };
    if (!nav.wakeLock) return;
    let lock: { release(): Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await nav.wakeLock!.request("screen");
        if (!cancelled) setHeld(true);
      } catch {
        setHeld(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
      setHeld(false);
    };
  }, [active]);
  return held;
}

/**
 * Geführte Kraft-/Mobility-Einheit: Übung für Übung mit Animation,
 * Satz-Zähler, Halte- und Pausen-Countdown. Ergebnisse werden NICHT gespeichert.
 */
export function StrengthPlayer({
  title,
  date,
  steps,
}: {
  title: string;
  date: string;
  steps: StrengthPlayerStep[];
}) {
  const metas = useMemo(() => steps.map(toMeta), [steps]);
  const [state, dispatch] = useReducer(
    (s: PlayerState, a: PlayerAction) => playerReducer(metas, s, a),
    metas,
    (m) => initialPlayerState(m),
  );
  const [remaining, setRemaining] = useState<number | null>(null);
  const [signalOn, setSignalOn] = useState(true);
  const signalRef = useRef(signalOn);
  signalRef.current = signalOn;
  const wakeLock = useWakeLock(!state.finished);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(SIGNAL_KEY);
      if (v === "off") setSignalOn(false);
    } catch {
      // Speicher nicht verfügbar
    }
  }, []);

  function toggleSignal(on: boolean) {
    setSignalOn(on);
    try {
      window.localStorage.setItem(SIGNAL_KEY, on ? "on" : "off");
    } catch {
      // Speicher nicht verfügbar
    }
  }

  // Countdown für Halten und Pause.
  useEffect(() => {
    if ((state.phase !== "hold" && state.phase !== "rest") || state.countdownSec == null) {
      setRemaining(null);
      return;
    }
    const endsAt = Date.now() + state.countdownSec * 1000;
    setRemaining(state.countdownSec);
    const id = window.setInterval(() => {
      const left = (endsAt - Date.now()) / 1000;
      if (left <= 0) {
        window.clearInterval(id);
        setRemaining(0);
        if (signalRef.current) signal();
        dispatch({ type: "timerEnd" });
      } else {
        setRemaining(left);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [state.phase, state.countdownSec, state.set, state.side, state.index]);

  if (steps.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Diese Einheit enthält keine Schritte.
      </p>
    );
  }

  const step = steps[state.index];
  const meta = metas[state.index];
  const progress = state.finished ? 1 : state.index / steps.length;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between gap-3 text-xs text-neutral-600">
          <span>
            {date} · {title}
          </span>
          <span>
            Schritt {state.index + 1} von {steps.length}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Gesamtfortschritt"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={state.finished ? steps.length : state.index}
          className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-neutral-200"
        >
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {state.finished ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-lg font-semibold text-emerald-800">Einheit geschafft!</p>
          <p className="mt-1 text-sm text-emerald-700">
            Ergebnisse werden hier nicht gespeichert.
          </p>
          <Link href="/trainer?tab=kraft" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
            Zurück zur Übersicht
          </Link>
        </div>
      ) : step.kind === "exercise" ? (
        <section
          aria-label={`Übung ${state.index + 1}`}
          className="rounded-2xl border border-neutral-200/80 bg-white p-4 md:p-6"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              {step.definition && isExercise3d(step.definition) ? (
                <Exercise3dViewer key={step.definition.id} definition={step.definition} compact />
              ) : step.definition ? (
                <ExerciseAnimation key={step.definition.id} definition={step.definition} showControls={false} />
              ) : (
                <ExercisePlaceholder id={step.exercise.id} reason={step.status === "invalid" ? "invalid" : "missing"} />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">
                {step.definition?.title ?? step.exercise.id}
              </h2>
              <p className="mt-0.5 text-sm text-neutral-700">
                {formatExerciseDose(step.exercise)}
                {step.exercise.restSec ? ` · Pause ${step.exercise.restSec} s` : ""}
              </p>
              {step.exercise.note || step.description ? (
                <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-sm text-amber-800">
                  {step.exercise.note ?? step.description}
                </p>
              ) : null}
              {step.definition ? (
                <Link
                  href={`/trainer/uebungen/${step.definition.id}`}
                  className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline"
                >
                  Anleitung und typische Fehler
                </Link>
              ) : null}

              <div className="mt-4 rounded-xl bg-neutral-50 p-4" aria-live="polite">
                <p className="text-sm font-medium text-neutral-700">
                  Satz {Math.min(state.set, meta.sets)} von {meta.sets}
                  {meta.perSide && meta.holdSec != null ? ` · Seite ${state.side}` : ""}
                </p>
                {state.phase === "hold" || state.phase === "rest" ? (
                  <p className="mt-1 font-display text-5xl font-medium tabular-nums text-neutral-900">
                    {fmtClock(remaining ?? state.countdownSec ?? 0)}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-neutral-600">
                  {state.phase === "hold"
                    ? "Halten"
                    : state.phase === "rest"
                      ? "Pause"
                      : state.phase === "stepDone"
                        ? "Übung erledigt"
                        : meta.holdSec != null
                          ? `${meta.holdSec} s halten`
                          : `${meta.reps} Wiederholungen${meta.perSide ? " pro Seite" : ""}`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {state.phase === "ready" && meta.holdSec != null ? (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "startHold" })}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                    >
                      Halten starten
                    </button>
                  ) : null}
                  {state.phase === "ready" && meta.holdSec == null ? (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "completeSet" })}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                    >
                      Satz erledigt
                    </button>
                  ) : null}
                  {state.phase === "rest" ? (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "skipRest" })}
                      className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                    >
                      Pause überspringen
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section
          aria-label={`Schritt ${state.index + 1}`}
          className="rounded-2xl border border-neutral-200/80 bg-white p-6"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {step.segmentType}
            {step.durationSec ? ` · ${Math.round(step.durationSec / 60)} min` : ""}
          </p>
          <p className="mt-1 text-lg text-neutral-900">
            {step.description ?? "Ohne Beschreibung"}
          </p>
        </section>
      )}

      {!state.finished ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "prev" })}
              disabled={state.index === 0}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
            >
              Zurück
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "next" })}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                state.phase === "stepDone"
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {state.index === steps.length - 1 ? "Einheit beenden" : "Weiter"}
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-600">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={signalOn}
                onChange={(e) => toggleSignal(e.target.checked)}
                className="accent-blue-600"
              />
              Signal am Ende von Countdowns
            </label>
            {wakeLock ? <span>Bildschirm bleibt an</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
