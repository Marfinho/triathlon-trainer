"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  cycleDuration,
  poseAt,
  renderPose3dSvg,
  timelineAt3d,
  type Exercise3dDefinition,
} from "@/domain/exercises/body3d";
import { registerAnimation } from "./animationLoop";
import type { Body3dRenderer, ViewMode } from "./three/body3dRenderer";

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

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * 3D-Ansicht einer Übung (Format 2.0): drehbarer Körper (three.js, wird
 * nachgeladen), Umschalter Körper/Muskeln, Abspielen, Tempo, Scrub-Regler und
 * Phasen-Label. Ohne WebGL zeigt sie dieselbe Szene als flache
 * SVG-Projektion. Bei „Bewegung reduzieren"
 * startet sie pausiert im ersten Zielbild.
 */
export function Exercise3dViewer({
  definition,
  compact = false,
  autoPlay = true,
}: {
  definition: Exercise3dDefinition;
  /** true = ohne Bedienelemente (z. B. im Kraft-Player) */
  compact?: boolean;
  autoPlay?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const phaseRef = useRef<HTMLParagraphElement>(null);
  const rendererRef = useRef<Body3dRenderer | null>(null);
  const state = useRef({ tau: 0, playing: false, speed: 1, visible: false, mode: "body" as ViewMode });
  const drawRef = useRef<() => void>(() => {});
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<ViewMode>("body");
  const [gl, setGl] = useState<"pending" | "on" | "off">("pending");
  const scrubId = useId();

  const total = useMemo(() => cycleDuration(definition), [definition]);
  const label = `3D-Animation: ${definition.title}`;
  const initialSvg = useMemo(
    () => renderPose3dSvg(definition, definition.keyframes[0], { label }),
    [definition, label],
  );

  // three.js nachladen (nur wenn WebGL vorhanden und nicht kompakt)
  useEffect(() => {
    if (!webglAvailable()) {
      setGl("off");
      return;
    }
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    Promise.all([import("./three/body3dRenderer"), import("./three/loadBodyModel").then((m) => m.loadBodyModel())])
      .then(([{ createBody3dRenderer }, model]) => {
        const canvas = canvasRef.current,
          host = hostRef.current;
        if (cancelled || !canvas || !host) return;
        const r = createBody3dRenderer(canvas, definition, host, model);
        rendererRef.current = r;
        const fit = () => {
          const w = host.clientWidth;
          r.resize(w, Math.round((w * 4) / 5));
          drawRef.current();
        };
        if (typeof ResizeObserver === "function") {
          resizeObserver = new ResizeObserver(fit);
          resizeObserver.observe(host);
        }
        setGl("on");
        fit();
      })
      .catch(() => {
        if (!cancelled) setGl("off");
      });
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [definition, compact]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const st = state.current;
    const reduce = prefersReducedMotion();
    st.tau = reduce ? definition.keyframes[0].toNextSec : 0;
    st.playing = autoPlay && !reduce;
    setPlaying(st.playing);

    function draw() {
      const tl = timelineAt3d(definition, st.tau);
      const pose = poseAt(definition, tl.at);
      const r = rendererRef.current;
      if (r) {
        r.setPose(pose, st.mode);
        r.render();
      } else {
        const flat = host!.querySelector<HTMLDivElement>(".b3flat");
        if (flat) flat.innerHTML = renderPose3dSvg(definition, pose, { mode: st.mode, label });
      }
      if (phaseRef.current) phaseRef.current.textContent = definition.keyframes[tl.labelIndex].label;
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
  }, [definition, total, autoPlay, label]);

  // Nach dem Umschalten (3D an/aus, Körper/Muskeln) neu zeichnen
  useEffect(() => {
    state.current.mode = mode;
    drawRef.current();
  }, [mode, gl]);

  // Drehen per Ziehen (Maus, Finger, Stift) und Pfeiltasten
  const drag = useRef<{ x: number; y: number } | null>(null);
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current,
      r = rendererRef.current;
    if (!d || !r) return;
    r.orbit((e.clientX - d.x) * 0.5, (e.clientY - d.y) * 0.4);
    drag.current = { x: e.clientX, y: e.clientY };
    if (!state.current.playing) drawRef.current();
  }
  function onPointerUp() {
    drag.current = null;
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    const r = rendererRef.current;
    if (!r) return;
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-15, 0],
      ArrowRight: [15, 0],
      ArrowUp: [0, 10],
      ArrowDown: [0, -10],
    };
    if (step[e.key]) {
      e.preventDefault();
      r.orbit(...step[e.key]);
    } else if (e.key === "+" || e.key === "-") {
      e.preventDefault();
      r.zoom(e.key === "+" ? 0.85 : 1.18);
    } else return;
    drawRef.current();
  }

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

  const toggleCls = (on: boolean) =>
    `px-3 py-1.5 text-sm font-semibold ${on ? "bg-blue-600 text-white" : "bg-white text-neutral-700 hover:bg-neutral-50"}`;

  return (
    <section aria-label={label}>
      <div ref={hostRef} className="exfig exfig-pane overflow-hidden">
        <canvas
          ref={canvasRef}
          className="b3gl"
          hidden={gl !== "on"}
          tabIndex={gl === "on" ? 0 : -1}
          role="img"
          aria-label={`${label}. Zum Drehen ziehen oder Pfeiltasten verwenden, + und − zum Zoomen.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        />
        <div
          className="b3flat"
          hidden={gl === "on"}
          // Nur Engine-Ausgabe (renderPose3dSvg escaped alle Texte).
          dangerouslySetInnerHTML={{ __html: initialSvg }}
        />
      </div>
      {compact ? null : (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-pressed={playing}
            className="min-w-[7rem] rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            {playing ? "❚❚ Pause" : "▶ Abspielen"}
          </button>
          <div role="group" aria-label="Darstellung" className="inline-flex overflow-hidden rounded-lg border border-neutral-300">
            <button type="button" aria-pressed={mode === "body"} onClick={() => setMode("body")} className={toggleCls(mode === "body")}>
              Körper
            </button>
            <button type="button" aria-pressed={mode === "muscles"} onClick={() => setMode("muscles")} className={toggleCls(mode === "muscles")}>
              Muskeln
            </button>
          </div>
          <label className="inline-flex items-center gap-1.5 text-sm text-neutral-600">
            Tempo
            <select
              value={speed}
              onChange={(e) => changeSpeed(Number(e.target.value))}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            >
              {SPEEDS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {gl === "on" ? (
            <button
              type="button"
              onClick={() => {
                rendererRef.current?.resetView();
                drawRef.current();
              }}
              className="text-sm font-semibold text-blue-700 underline-offset-2 hover:underline"
            >
              Ansicht zurücksetzen
            </button>
          ) : null}
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
      )}
      <p ref={phaseRef} aria-live="off" className="mt-2 min-h-[1.5em] text-sm font-semibold text-neutral-900">
        {definition.keyframes[0].label}
      </p>
      {compact ? null : (
        <p className="text-sm text-neutral-600">
          {definition.tempoText}
          {gl === "on" ? " · Zum Drehen ziehen." : null}
        </p>
      )}
    </section>
  );
}
