import { mapply, mcol, rotateBetween, vadd, vcross, vdot, vlen, vnorm, vscale, vsub, type M3, type V3 } from "./math";
import { DIMS } from "./skeleton";
import { MUSCLES, MUSCLE_IDS, type MuscleId } from "./muscles";
import { boneToWorld, forwardKinematics, solvePose, type BodyFrames } from "./kinematics";
import type { Exercise3dDefinition, Pose3d, Prop3d } from "./schema";

/**
 * Szene = Liste einfacher Körper (Kapseln, Ellipsoide, Muskel-Spindeln) in cm.
 * Grundlage für den 3D-Viewer (three.js) UND die flache SVG-Darstellung.
 */
export type Part = "shirt" | "pants" | "skin" | "shoe" | "hair";

export interface Capsule {
  kind: "capsule";
  id: string;
  a: V3;
  b: V3;
  ra: number;
  rb: number;
  part: Part;
}
export interface Ellipsoid {
  kind: "ellipsoid";
  id: string;
  center: V3;
  /** Spalten = Achsen x, y, z */
  R: M3;
  radii: V3;
  part: Part;
}
export type MuscleRole = "work" | "stretch" | "stabilize" | "idle";
export interface MusclePrim {
  kind: "muscle";
  id: string;
  /** Katalog-ID ohne Seite */
  muscle: MuscleId;
  side: "l" | "r" | "c";
  center: V3;
  R: M3;
  radii: V3;
  role: MuscleRole;
  /** 0 … 1 */
  activation: number;
  /** Länge / Ruhelänge */
  stretch: number;
}
export type Primitive = Capsule | Ellipsoid | MusclePrim;

export interface SceneOptions {
  /** "body" = Körper + Zielmuskeln, "muscles" = alle Muskeln, Haut aus */
  mode?: "body" | "muscles";
}

export interface Scene3d {
  primitives: Primitive[];
  props: Prop3d[];
  frames: BodyFrames;
}

const SIDES = [
  ["l", -1],
  ["r", 1],
] as const;

function frameFromAxis(axis: V3, normalHint: V3): M3 {
  const y = vnorm(axis);
  let z = vsub(normalHint, vscale(y, vdot(normalHint, y)));
  if (vlen(z) < 1e-6) z = Math.abs(y[0]) < 0.9 ? vcross(y, [1, 0, 0]) : vcross(y, [0, 0, 1]);
  z = vnorm(z);
  const x = vcross(y, z);
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

function boneOf(bone: string, side: "l" | "r"): string {
  return bone.replace("*", side);
}

function muscleEnds(frames: BodyFrames, id: MuscleId, side: "l" | "r" | "c"): [V3, V3, string] {
  const m = MUSCLES[id];
  const s = side === "l" ? -1 : 1;
  const zf = m.kind === "pair" ? s : 1;
  const sd = side === "c" ? "r" : side;
  const ob = boneOf(m.origin.bone, sd) as keyof BodyFrames;
  const ib = boneOf(m.insertion.bone, sd) as keyof BodyFrames;
  const a = boneToWorld(frames, ob, [m.origin.offset[0], m.origin.offset[1], m.origin.offset[2] * zf]);
  const b = boneToWorld(frames, ib, [m.insertion.offset[0], m.insertion.offset[1], m.insertion.offset[2] * zf]);
  return [a, b, ob];
}

let restLengths: Map<string, number> | null = null;
function restLength(id: MuscleId, side: "l" | "r" | "c"): number {
  if (!restLengths) {
    restLengths = new Map();
    const f = forwardKinematics({}, [0, DIMS.pelvisHeight, 0]);
    for (const mid of MUSCLE_IDS) {
      const sides = MUSCLES[mid].kind === "pair" ? (["l", "r"] as const) : (["c"] as const);
      for (const sd of sides) {
        const [a, b] = muscleEnds(f, mid, sd);
        restLengths.set(`${mid}_${sd}`, vlen(vsub(b, a)));
      }
    }
  }
  return restLengths.get(`${id}_${side}`) ?? 1;
}

function bodyPrimitives(f: BodyFrames): Primitive[] {
  const out: Primitive[] = [];
  const at = (bone: keyof BodyFrames, o: V3) => boneToWorld(f, bone, o);
  const ell = (id: string, bone: keyof BodyFrames, o: V3, radii: V3, part: Part): Ellipsoid => ({
    kind: "ellipsoid",
    id,
    center: at(bone, o),
    R: f[bone].R,
    radii,
    part,
  });
  out.push(ell("pelvis", "pelvis", [0, -2, 0], [11, 12.5, 15.5], "pants"));
  out.push(ell("abdomen", "spine_low", [0.5, 9, 0], [10.5, 15, 14.5], "shirt"));
  out.push(ell("chest", "spine_up", [1, 11, 0], [11.5, 16, 17.5], "shirt"));
  out.push({ kind: "capsule", id: "neck", a: f.neck.origin, b: at("neck", [1, 8, 0]), ra: 5.2, rb: 5, part: "skin" });
  out.push(ell("head", "neck", [2, 13, 0], [10, 11.5, 9], "skin"));
  out.push(ell("hair", "neck", [-1.8, 15.2, 0], [9.4, 9.8, 9.3], "hair"));
  for (const [sd] of SIDES) {
    const th = `thigh_${sd}` as const,
      sh = `shank_${sd}` as const,
      ft = `foot_${sd}` as const,
      ua = `upperarm_${sd}` as const,
      fa = `forearm_${sd}` as const;
    out.push({ kind: "capsule", id: `thigh_${sd}`, a: f[th].origin, b: f[sh].origin, ra: 8.2, rb: 6, part: "pants" });
    out.push({ kind: "capsule", id: `shank_${sd}`, a: f[sh].origin, b: f[ft].origin, ra: 5.8, rb: 4.1, part: "skin" });
    out.push({ kind: "capsule", id: `heel_${sd}`, a: f[ft].origin, b: at(ft, [-4, -4.2, 0]), ra: 4.3, rb: 3.6, part: "shoe" });
    out.push({ kind: "capsule", id: `foot_${sd}`, a: at(ft, [-4, -4.2, 0]), b: at(ft, [18, -4.6, 0]), ra: 3.6, rb: 3.2, part: "shoe" });
    out.push({ kind: "capsule", id: `shoulder_${sd}`, a: f[ua].origin, b: at(ua, [0, -7, 0]), ra: 6, rb: 5, part: "shirt" });
    out.push({ kind: "capsule", id: `upperarm_${sd}`, a: f[ua].origin, b: f[fa].origin, ra: 4.6, rb: 3.8, part: "skin" });
    out.push({ kind: "capsule", id: `forearm_${sd}`, a: f[fa].origin, b: at(fa, [0, -DIMS.forearm, 0]), ra: 3.8, rb: 2.9, part: "skin" });
    out.push({ kind: "capsule", id: `hand_${sd}`, a: at(fa, [0, -DIMS.forearm, 0]), b: at(fa, [0, -DIMS.forearm - 15, 0]), ra: 3, rb: 2.5, part: "skin" });
  }
  return out;
}

/** Rolle und Aktivierung je Muskel-Instanz aus Definition + Pose. */
function muscleState(def: Exercise3dDefinition, activation: Record<string, number>, id: MuscleId, side: "l" | "r" | "c") {
  const sided = side === "c" ? id : `${id}_${side}`;
  const entry = def.muscles.find((m) => m.id === sided) ?? def.muscles.find((m) => m.id === id);
  const role: MuscleRole = entry ? entry.role : "idle";
  const act = activation[sided] ?? activation[id] ?? (entry ? 0.6 : 0);
  return { role, activation: Math.min(Math.max(act, 0), 1), listed: !!entry };
}

export function buildScene(def: Exercise3dDefinition, pose: Pose3d, opts: SceneOptions = {}): Scene3d {
  const solved = solvePose(pose, def.props);
  const f = solved.frames;
  const primitives: Primitive[] = opts.mode === "muscles" ? [] : bodyPrimitives(f);
  if (opts.mode === "muscles") {
    // Muskel-Ansicht: schlanker Körperkern (Knochen-Andeutung) statt Haut
    for (const p of bodyPrimitives(f)) {
      if (p.kind === "capsule")
        primitives.push({ ...p, ra: p.ra * 0.45, rb: p.rb * 0.45, part: p.part === "shoe" ? "shoe" : "skin" });
      else if (p.id === "head" || p.id === "hair") primitives.push(p);
      else if (p.kind === "ellipsoid") primitives.push({ ...p, radii: vscale(p.radii, 0.6) as V3 });
    }
  }
  for (const id of MUSCLE_IDS) {
    const sides = MUSCLES[id].kind === "pair" ? (["l", "r"] as const) : (["c"] as const);
    for (const sd of sides) {
      const st = muscleState(def, solved.activation, id, sd);
      if (opts.mode !== "muscles" && !st.listed) continue;
      const [a, b, originBone] = muscleEnds(f, id, sd);
      const axis = vsub(b, a);
      const len = vlen(axis);
      const center = vscale(vadd(a, b), 0.5);
      const normal = vsub(center, f[originBone as keyof BodyFrames].origin);
      const R = frameFromAxis(axis, normal);
      const m = MUSCLES[id] as { radius: number; flat?: number };
      const r = m.radius * (1 + 0.15 * (st.role === "work" || st.role === "stabilize" ? st.activation : 0));
      primitives.push({
        kind: "muscle",
        id: `${id}_${sd}`,
        muscle: id,
        side: sd,
        center,
        R,
        radii: [r, len / 2, r * (m.flat ?? 1)],
        role: st.role,
        activation: st.activation,
        stretch: len / restLength(id, sd),
      });
    }
  }
  return { primitives, props: def.props, frames: f };
}

/** Richtung (Achse) einer Muskel-Spindel, z. B. für three.js. */
export function axisOf(p: MusclePrim | Ellipsoid): V3 {
  return mcol(p.R, 1);
}

export { rotateBetween, mapply };
