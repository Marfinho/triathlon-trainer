/**
 * Workout-Player – baut aus den Segmenten eines Rad-Workouts eine zeitliche
 * Watt-Timeline und findet den aktiven Schritt zu einer verstrichenen Zeit.
 *
 * Rein/testbar. Bluetooth/Geräte kommen erst im Kickr-Client dazu.
 */

import { resolveSegmentWatts, type ResolvableSegment } from "./watts";

export interface TimelineSegmentInput extends ResolvableSegment {
  durationSec?: number | null;
  description?: string | null;
}

export interface TimelineStep {
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  targetWatts: number;
  rangeWatts?: [number, number];
  label: string;
  source: string;
}

export interface WorkoutTimeline {
  steps: TimelineStep[];
  totalDurationSec: number;
  ftp: number;
}

function labelFor(segment: TimelineSegmentInput, index: number): string {
  const kind = segment.type ?? segment.intensity ?? "segment";
  const desc = segment.description ? ` – ${segment.description}` : "";
  return `${index + 1}. ${kind}${desc}`;
}

/**
 * Baut die Timeline. Segmente ohne positive Dauer werden übersprungen (für eine
 * zeitgesteuerte ERG-Wiedergabe ungeeignet). `type === "rest"` ergibt 0 Watt.
 */
export function buildWorkoutTimeline(
  segments: TimelineSegmentInput[],
  opts: { ftp: number },
): WorkoutTimeline {
  const steps: TimelineStep[] = [];
  let cursor = 0;
  let index = 0;

  for (const segment of segments) {
    const durationSec =
      typeof segment.durationSec === "number" ? segment.durationSec : 0;
    if (durationSec <= 0) continue;

    const isRest = segment.type === "rest";
    const resolved = isRest
      ? { target: 0, source: "zone" as const }
      : resolveSegmentWatts(segment, { ftp: opts.ftp });

    steps.push({
      index,
      startSec: cursor,
      endSec: cursor + durationSec,
      durationSec,
      targetWatts: resolved.target,
      rangeWatts: "range" in resolved ? resolved.range : undefined,
      label: labelFor(segment, index),
      source: resolved.source,
    });

    cursor += durationSec;
    index += 1;
  }

  return { steps, totalDurationSec: cursor, ftp: opts.ftp };
}

export interface ActiveStep {
  step: TimelineStep | null;
  stepIndex: number;
  secondsIntoStep: number;
  secondsRemainingInStep: number;
  isComplete: boolean;
}

/** Findet den aktiven Schritt zu einer verstrichenen Gesamtzeit. */
export function stepAt(
  timeline: WorkoutTimeline,
  elapsedSec: number,
): ActiveStep {
  if (elapsedSec >= timeline.totalDurationSec) {
    return {
      step: null,
      stepIndex: timeline.steps.length,
      secondsIntoStep: 0,
      secondsRemainingInStep: 0,
      isComplete: true,
    };
  }
  for (const step of timeline.steps) {
    if (elapsedSec < step.endSec) {
      return {
        step,
        stepIndex: step.index,
        secondsIntoStep: elapsedSec - step.startSec,
        secondsRemainingInStep: step.endSec - elapsedSec,
        isComplete: false,
      };
    }
  }
  return {
    step: null,
    stepIndex: timeline.steps.length,
    secondsIntoStep: 0,
    secondsRemainingInStep: 0,
    isComplete: true,
  };
}
