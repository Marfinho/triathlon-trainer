"use client";

import { useEffect, useRef, useState } from "react";
import type { Exercise3dDefinition } from "@/domain/exercises/body3d";
import type { StillMarker, StillSpec } from "./three/stillRenderer";

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Standbild einer 3D-Übung. Server und Geräte ohne WebGL zeigen die flache
 * SVG-Fassung (`svg`, Engine-Ausgabe); im Browser wird sie durch ein Bild des
 * echten 3D-Körpers ersetzt, sobald es gerendert ist.
 */
export function Exercise3dStill({
  definition,
  spec,
  svg,
  label,
  className = "",
  framed = true,
}: {
  definition: Exercise3dDefinition;
  spec: StillSpec;
  svg: string;
  label: string;
  className?: string;
  framed?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<{ url: string; markers: StillMarker[] } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !webglAvailable()) return;
    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    const start = () =>
      import("./three/stillRenderer")
        .then(({ renderStill }) => renderStill(definition, spec, host))
        .then((r) => {
          if (!cancelled && r) setImg(r);
        })
        .catch(() => {});
    // erst rendern, wenn das Bild in die Nähe des sichtbaren Bereichs kommt
    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer?.disconnect();
            start();
          }
        },
        { rootMargin: "300px" },
      );
      observer.observe(host);
    } else start();
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
    // spec ist ein kleines Objekt-Literal: als JSON vergleichen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition, JSON.stringify(spec)]);

  return (
    <div ref={hostRef} className={`exfig ${framed ? "exfig-pane" : ""} relative overflow-hidden ${className}`}>
      {img ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- Daten-URL aus dem eigenen Renderer */}
          <img src={img.url} alt={label} className="block h-auto w-full" width={600} height={480} />
          {img.markers.map((m) => (
            <span
              key={m.n}
              aria-hidden="true"
              className={`exfig-num absolute -translate-x-1/2 -translate-y-1/2 scale-90 ${m.stretch ? "stretch" : ""}`}
              style={{ left: `${(m.x * 100).toFixed(1)}%`, top: `${(m.y * 100).toFixed(1)}%` }}
            >
              {m.n}
            </span>
          ))}
        </>
      ) : (
        // Nur Engine-Ausgabe (siehe ExerciseFigure).
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      )}
    </div>
  );
}
