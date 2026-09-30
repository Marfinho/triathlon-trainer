"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  phaseLabels,
  renderBodyAt,
  renderPlayerShellSvg,
  tempoTotal,
  timelineAt,
} from "@/domain/exercises/engine";
import type { ExerciseDefinition } from "@/domain/exercises/schema";
import { registerAnimation } from "./animationLoop";

const SPEEDS = [
  { value: 0.5, label: "0,5×" },
  { value: 1, label: "1×" },
  { value: 1.5, label: "1,5×" },
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Animation einer Übung (Verhalten und Timing wie im Prototyp): Play/Pause,
 * Tempo, Scrub-Regler, Phasen-Label. Bei „Bewegung reduzieren" startet sie
 * pausiert in der Endposition. Gezeichnet wird ausschließlich Engine-Ausgabe.
 */
export function ExerciseAnimation({
  definition,
  showControls = true,
  autoPlay = true,
}: {
  definition: ExerciseDefinition;
  showControls?: boolean;
  autoPlay?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const phaseRef = useRef<HTMLParagraphElement>(null);
  const state = useRef({ tau: 0, playing: false, speed: 1, visible: false });
  const drawRef = useRef<() => void>(() => {});
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const scrubId = useId();

  const total = useMemo(() => tempoTotal(definition.tempo), [definition]);
  const labels = useMemo(() => phaseLabels(definition), [definition]);
  // Startbild für Server-Render/ohne JS: Körper bei u = 0.
  const initialSvg = useMemo(
    () =>
      renderPlayerShellSvg(definition).replace(
        '<g class="dyn"></g>',
        `<g class="dyn">${renderBodyAt(definition, 0)}</g>`,
      ),
    [definition],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const st = state.current;
    const reduce = prefersReducedMotion();
    st.tau = reduce ? definition.tempo.toEndSec : 0;
    st.playing = autoPlay && !reduce;
    setPlaying(st.playing);

    function draw() {
      const tl = timelineAt(definition.tempo, st.tau);
      // Gruppe bei jedem Zeichnen frisch holen: React kann den Host-Inhalt
      // (dangerouslySetInnerHTML) nach der Hydration neu setzen.
      const dyn = host!.querySelector<SVGGElement>(".dyn");
      if (dyn) dyn.innerHTML = renderBodyAt(definition, tl.u);
      if (phaseRef.current) phaseRef.current.textContent = labels[tl.ph];
      if (scrubRef.current) scrubRef.current.value = String(Math.round((st.tau / total) * 1000));
    }
    drawRef.current = draw;
    draw();

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(
        (entries) => entries.forEach((e) => (st.visible = e.isIntersecting)),
        { threshold: 0.1 },
      );
      observer.observe(host);
    } else {
      st.visible = true;
    }

    const unregister = registerAnimation({
      isActive: () => st.playing && st.visible,
      advance: (dt) => {
        st.tau = (st.tau + dt * st.speed) % total;
        draw();
      },
    });
    return () => {
      unregister();
      observer?.disconnect();
    };
  }, [definition, total, labels, autoPlay]);

  function togglePlay() {
    const st = state.current;
    st.playing = !st.playing;
    setPlaying(st.playing);
  }

  function changeSpeed(v: number) {
    state.current.speed = v;
    setSpeed(v);
  }

  function scrub(v: number) {
    const st = state.current;
    st.playing = false;
    setPlaying(false);
    st.tau = (v / 1000) * total * 0.9999;
    drawRef.current();
  }

  return (
    <section aria-label={`Animation: ${definition.title}`}>
      <div
        ref={hostRef}
        className="exfig exfig-pane"
        // Nur Engine-Ausgabe (siehe ExerciseFigure).
        dangerouslySetInnerHTML={{ __html: initialSvg }}
      />
      {showControls ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-pressed={playing}
            className="min-w-[7rem] rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            {playing ? "❚❚ Pause" : "▶ Abspielen"}
          </button>
          <label className="inline-flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
            Tempo
            <select
              value={speed}
              onChange={(e) => changeSpeed(Number(e.target.value))}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {SPEEDS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={scrubId} className="sr-only">
            Position im Ablauf
          </label>
          <input
            id={scrubId}
            ref={scrubRef}
            type="range"
            min={0}
            max={1000}
            defaultValue={0}
            onChange={(e) => scrub(Number(e.target.value))}
            className="w-full basis-full accent-blue-600"
          />
        </div>
      ) : null}
      <p
        ref={phaseRef}
        aria-live="off"
        className="mt-2 min-h-[1.5em] text-sm font-semibold text-neutral-900 dark:text-neutral-100"
      >
        {labels[3]}
      </p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{definition.tempoText}</p>
    </section>
  );
}
