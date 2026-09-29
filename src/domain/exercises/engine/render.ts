import type { ExerciseDefinition } from "../schema";
import { toEngineExercise } from "./adapter";
import { drawBody, drawMarkers, type MuscleMeta } from "./draw";
import { escapeXml } from "./escape";
import { mixPose, normPose } from "./pose";
import type { EngineExercise } from "./types";

/* ---------- Zusammenbau (1:1 aus der Referenz-Engine) ---------- */

export const VIEWBOX = "0 -20 200 170";
export const GROUND_Y = 136;
const GROUND = '<line class="gnd" x1="0" y1="' + GROUND_Y + '" x2="200" y2="' + GROUND_Y + '"/>';

/**
 * Pfeilspitzen-Definition `#ah`. Gehört EINMAL pro Seite in ein verstecktes
 * `<svg><defs>` (siehe `ExerciseSvgDefs`).
 */
export const ARROW_MARKER_DEFS =
  '<marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" class="mk"/></marker>';

function metaMap(ex: EngineExercise): MuscleMeta {
  const o: MuscleMeta = {};
  ex.muscles.forEach((m) => {
    o[m.key] = m;
  });
  return o;
}

function svgWrap(inner: string, label: string): string {
  return (
    '<svg class="fig" viewBox="' +
    VIEWBOX +
    '" role="img" aria-label="' +
    escapeXml(label) +
    '" xmlns="http://www.w3.org/2000/svg">' +
    inner +
    "</svg>"
  );
}

/** Muskelbild: Endpose mit farbigen Muskeln und nummerierten Markern. */
export function renderHeroSvg(def: ExerciseDefinition): string {
  const ex = toEngineExercise(def);
  const meta = metaMap(ex),
    pose = normPose(ex.T),
    b = drawBody(pose, meta, false);
  return svgWrap(
    GROUND + (ex.T.back || "") + b.svg + drawMarkers(b.marks, ex.muscles),
    "Zielmuskeln bei " + ex.title,
  );
}

/**
 * Ablauf-Bild 0…3. Requisiten der Startpose; blasse Figur: Bild 2 und 3 die
 * Startpose, Bild 4 die Endpose, Bild 1 keine. Beschriftungen nur bei t = 0
 * (Start) bzw. t = 1 (Ende).
 */
export function renderFrameSvg(def: ExerciseDefinition, frameIndex: number): string {
  const ex = toEngineExercise(def);
  const fr = ex.frames[frameIndex];
  if (!fr) throw new RangeError(`Bild ${frameIndex} existiert nicht (0–3).`);
  const idx = frameIndex;
  const meta = metaMap(ex),
    t = fr[0],
    pose = mixPose(ex.S, ex.T, t);
  const g = idx > 0 ? drawBody(normPose(idx === 3 ? ex.T : ex.S), meta, true).svg : "";
  const extra = t === 0 ? ex.S.extra || "" : t === 1 ? ex.T.extra || "" : "";
  const b = drawBody(pose, meta, false);
  return svgWrap(
    GROUND + (ex.S.back || "") + g + b.svg + extra,
    ex.title + ", Bild " + (idx + 1) + ": " + fr[1],
  );
}

/** Fehlerbild (ohne Muskelmarker) oder null, wenn die Übung keines hat. */
export function renderFaultSvg(def: ExerciseDefinition): string | null {
  const ex = toEngineExercise(def);
  if (!ex.F) return null;
  const pose = normPose(ex.F),
    b = drawBody(pose, {}, false);
  return svgWrap(GROUND + (ex.F.back || "") + b.svg + (ex.F.extra || ""), "Häufiger Fehler bei " + ex.title);
}

export interface RenderBodyOptions {
  /** true = blasse Figur ohne Muskeln und Geräte */
  ghost?: boolean;
}

/**
 * Inneres SVG des Körpers bei Bewegungsposition u (0 = Start, 1 = Ende) für
 * die Animation; ohne Boden, Requisiten und Beschriftungen.
 */
export function renderBodyAt(
  def: ExerciseDefinition,
  u: number,
  opts: RenderBodyOptions = {},
): string {
  const ex = toEngineExercise(def);
  const uu = Number.isFinite(u) ? Math.min(Math.max(u, 0), 1) : 0;
  return drawBody(mixPose(ex.S, ex.T, uu), metaMap(ex), !!opts.ghost).svg;
}

/**
 * Äußere Hülle des Animations-SVG (Boden + Requisiten der Startpose) mit einer
 * leeren Gruppe `<g class="dyn"></g>`, in die `renderBodyAt` geschrieben wird.
 */
export function renderPlayerShellSvg(def: ExerciseDefinition): string {
  const ex = toEngineExercise(def);
  return svgWrap(GROUND + (ex.S.back || "") + '<g class="dyn"></g>', "Animation: " + ex.title);
}

/** Kleines statisches Bild der Endposition (für Listen). */
export function renderThumbSvg(def: ExerciseDefinition): string {
  const ex = toEngineExercise(def);
  const b = drawBody(normPose(ex.T), metaMap(ex), false);
  return svgWrap(GROUND + (ex.T.back || "") + b.svg, ex.title);
}

/** Phasen-Beschriftungen der Animation: [zum Ende, Halten, zurück, Start]. */
export function phaseLabels(def: ExerciseDefinition): [string, string, string, string] {
  const f = def.frames;
  return [f[1].label, f[2].label, f[3].label, f[0].label];
}
