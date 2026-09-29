import type { Annotation, ExerciseDefinition, Limb, Pose, Prop } from "../schema";
import { escapeXml } from "./escape";
import type { EngineExercise, EngineLimb, EnginePose } from "./types";

/**
 * Adapter Bibliotheksformat → Engine-Form (Kürzel der Referenz-Engine).
 * Zahlen in Requisiten/Beschriftungen werden unformatiert (String(n))
 * ausgegeben, genau wie im JSON.
 */

/** Knochenlängen [l1, l2]: Bein 30/30, Arm 20/18. */
const LEG_BONES = [30, 30] as const;
const ARM_BONES = [20, 18] as const;

function toEngineLimb(l: Limb): EngineLimb {
  const bones = l.root === "hip" ? LEG_BONES : ARM_BONES;
  const out: EngineLimb = {
    root: l.root === "hip" ? "P" : "N",
    foot: l.foot
      ? [l.foot.angle, l.foot.toeAngle, l.foot.direction, l.foot.flip ? 1 : 0]
      : null,
    m: [...l.muscles],
  };
  if (l.ik) out.ik = [[l.ik.end[0], l.ik.end[1]], l.ik.bend, bones[0], bones[1]];
  if (l.points)
    out.pts = [
      [l.points[0][0], l.points[0][1]],
      [l.points[1][0], l.points[1][1]],
    ];
  return out;
}

/** SVG für Requisiten (Feld `back`). */
export function propsToSvg(props: Prop[]): string {
  let s = "";
  for (const p of props) {
    if (p.type === "box") {
      s += `<rect class="prop" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="2"/>`;
    } else {
      s += `<rect class="prop" x="${p.x}" y="-12" width="${p.w}" height="148"/>`;
      for (let yy = -4; yy < 140; yy += 12) {
        s += `<line class="hatch" x1="${p.x}" y1="${yy + 8}" x2="${p.x + p.w}" y2="${yy}"/>`;
      }
    }
  }
  return s;
}

/** SVG für Beschriftungen (Feld `extra`), Texte XML-escaped. */
export function annotationsToSvg(annotations: Annotation[]): string {
  let s = "";
  for (const a of annotations) {
    if (a.type === "arrow") {
      const d = a.curve
        ? `M${a.from[0]},${a.from[1]} Q${a.curve[0]},${a.curve[1]} ${a.to[0]},${a.to[1]}`
        : `M${a.from[0]},${a.from[1]} L${a.to[0]},${a.to[1]}`;
      s += `<path class="arr" d="${d}" marker-end="url(#ah)"/>`;
    } else if (a.type === "guide") {
      s += `<path class="ideal" d="M${a.from[0]},${a.from[1]} L${a.to[0]},${a.to[1]}"/>`;
    } else {
      s += `<text class="t" x="${a.at[0]}" y="${a.at[1]}" text-anchor="${a.anchor}">${escapeXml(a.text)}</text>`;
    }
  }
  return s;
}

export function toEnginePose(p: Pose): EnginePose {
  const out: EnginePose = {
    P: [p.hip[0], p.hip[1]],
    noff: p.frontView,
    tm: [...p.torsoMuscles],
    far: p.farLimbs.map(toEngineLimb),
    near: p.nearLimbs.map(toEngineLimb),
    back: propsToSvg(p.props),
    extra: annotationsToSvg(p.annotations),
  };
  if (p.neck) out.N = [p.neck[0], p.neck[1]];
  else out.lean = p.lean ?? 0;
  if (p.head) out.H = [p.head[0], p.head[1]];
  if (p.headOffset != null) out.hd = p.headOffset;
  if (p.spine)
    out.spine = [
      [p.spine[0][0], p.spine[0][1]],
      [p.spine[1][0], p.spine[1][1]],
      [p.spine[2][0], p.spine[2][1]],
    ];
  if (p.kettlebell)
    out.kb = { arm: p.kettlebell.nearLimb, off: [p.kettlebell.offset[0], p.kettlebell.offset[1]] };
  if (p.band) out.band = { from: [p.band.from[0], p.band.from[1]], limb: p.band.nearLimb };
  return out;
}

const cache = new WeakMap<ExerciseDefinition, EngineExercise>();

/** Übersetzt eine Übungsdefinition (Ergebnis wird je Objekt zwischengespeichert). */
export function toEngineExercise(def: ExerciseDefinition): EngineExercise {
  const hit = cache.get(def);
  if (hit) return hit;
  const ex: EngineExercise = {
    id: def.id,
    title: def.title,
    S: toEnginePose(def.start),
    T: toEnginePose(def.end),
    F: def.fault ? toEnginePose(def.fault) : null,
    faultCap: def.faultCaption,
    muscles: def.muscles.map((m) => ({
      key: m.key,
      label: m.label,
      note: m.note,
      lv: m.level,
      kind: m.kind,
    })),
    frames: def.frames.map((f): [number, string] => [f.t, f.label]),
    tempo: [def.tempo.toEndSec, def.tempo.holdEndSec, def.tempo.toStartSec, def.tempo.holdStartSec],
  };
  cache.set(def, ex);
  return ex;
}
