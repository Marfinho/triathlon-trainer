import {
  mapply,
  mmul,
  rotateBetween,
  rx,
  ry,
  rz,
  vadd,
  vdot,
  vcross,
  vlen,
  vnorm,
  vscale,
  vsub,
  type M3,
  type V3,
} from "./math";
import {
  CONTACT_POINTS,
  DIMS,
  IK_CONTACTS,
  type BoneName,
  type ContactPointName,
  type JointName,
} from "./skeleton";
import type { Exercise3dDefinition, JointAngles, Pose3d, Prop3d } from "./schema";

/**
 * Kinematik des 3D-Körpers (rein, deterministisch):
 *  1. Vorwärtskinematik aus Gelenkwinkeln
 *  2. Kontakte lösen: Becken verschieben, Hände/Füße per Zwei-Knochen-IK
 *     auf Boden, Box oder Wand führen
 *  3. Zeitleiste über die Schlüsselbilder mit weicher Interpolation
 */

export interface BoneFrame {
  origin: V3;
  R: M3;
}
export type BodyFrames = Record<BoneName, BoneFrame>;

export interface ContactResult {
  point: ContactPointName;
  surface: string;
  /** verbleibende Abweichung (cm), positiv = schwebt */
  residual: number;
}

export interface SolvedPose {
  frames: BodyFrames;
  contacts: ContactResult[];
  /** Größte IK-Korrektur je Kette (cm) */
  ikCorrection: number;
  activation: Record<string, number>;
}

type Side = "l" | "r";
const SIGN: Record<Side, number> = { l: -1, r: 1 };

function angle(j: JointAngles, joint: JointName, dof: string): number {
  return j[joint]?.[dof] ?? 0;
}

/** Vorwärtskinematik: Gelenkwinkel + Beckenposition → Knochen-Frames. */
export function forwardKinematics(j: JointAngles, root: V3): BodyFrames {
  const Rp = mmul(mmul(ry(angle(j, "pelvis", "yaw")), rz(-angle(j, "pelvis", "pitch"))), rx(-angle(j, "pelvis", "roll")));
  const spineR = (name: "spine_low" | "spine_up" | "neck") =>
    mmul(mmul(rz(-angle(j, name, "flex")), rx(-angle(j, name, "lateral"))), ry(angle(j, name, "rot")));
  const Rsl = mmul(Rp, spineR("spine_low"));
  const Rsu = mmul(Rsl, spineR("spine_up"));
  const Rn = mmul(Rsu, spineR("neck"));

  const P = root;
  const L = vadd(P, mapply(Rp, [0, DIMS.lumbar, 0]));
  const T = vadd(L, mapply(Rsl, [0, DIMS.thoracic, 0]));
  const C7 = vadd(T, mapply(Rsu, [0, DIMS.neckBase, 0]));

  const frames = {
    pelvis: { origin: P, R: Rp },
    spine_low: { origin: L, R: Rsl },
    spine_up: { origin: T, R: Rsu },
    neck: { origin: C7, R: Rn },
  } as BodyFrames;

  for (const side of ["l", "r"] as Side[]) {
    const s = SIGN[side];
    const hipJ = `hip_${side}` as JointName,
      kneeJ = `knee_${side}` as JointName,
      ankleJ = `ankle_${side}` as JointName,
      shJ = `shoulder_${side}` as JointName,
      elJ = `elbow_${side}` as JointName;
    const H = vadd(P, mapply(Rp, [DIMS.hip[0], DIMS.hip[1], DIMS.hip[2] * s]));
    const Rh = mmul(
      Rp,
      mmul(mmul(rz(angle(j, hipJ, "flex")), rx(-s * angle(j, hipJ, "abd"))), ry(-s * angle(j, hipJ, "rot"))),
    );
    const K = vadd(H, mapply(Rh, [0, -DIMS.thigh, 0]));
    const Rk = mmul(Rh, rz(-angle(j, kneeJ, "flex")));
    const A = vadd(K, mapply(Rk, [0, -DIMS.shank, 0]));
    const Ra = mmul(Rk, rz(angle(j, ankleJ, "dorsi")));

    const S = vadd(T, mapply(Rsu, [DIMS.shoulder[0], DIMS.shoulder[1], DIMS.shoulder[2] * s]));
    const Rs = mmul(
      Rsu,
      mmul(mmul(rz(angle(j, shJ, "flex")), rx(-s * angle(j, shJ, "abd"))), ry(-s * angle(j, shJ, "rot"))),
    );
    const E = vadd(S, mapply(Rs, [0, -DIMS.upperArm, 0]));
    const Re = mmul(Rs, rz(angle(j, elJ, "flex")));

    frames[`thigh_${side}`] = { origin: H, R: Rh };
    frames[`shank_${side}`] = { origin: K, R: Rk };
    frames[`foot_${side}`] = { origin: A, R: Ra };
    frames[`upperarm_${side}`] = { origin: S, R: Rs };
    frames[`forearm_${side}`] = { origin: E, R: Re };
  }
  return frames;
}

/** Weltposition eines Punkts im Knochen-Frame. */
export function boneToWorld(frames: BodyFrames, bone: BoneName, offset: readonly number[]): V3 {
  const f = frames[bone];
  return vadd(f.origin, mapply(f.R, [offset[0], offset[1], offset[2]]));
}

export function contactPointWorld(frames: BodyFrames, name: ContactPointName): V3 {
  const c = CONTACT_POINTS[name];
  return boneToWorld(frames, c.bone, c.offset);
}

interface Target {
  axis: 0 | 1;
  value: number;
}

function surfaceTarget(name: ContactPointName, surface: string, props: Prop3d[], p: V3): Target | null {
  const r = CONTACT_POINTS[name].radius;
  if (surface === "floor") return { axis: 1, value: r };
  const prop = props.find((q) => "id" in q && q.id === surface);
  if (!prop) return null;
  if (prop.type === "box") return { axis: 1, value: prop.h + r };
  if (prop.type === "wall") return { axis: 0, value: p[0] <= prop.x ? prop.x - r : prop.x + r };
  return null;
}

function residualOf(frames: BodyFrames, name: ContactPointName, surface: string, props: Prop3d[]): number | null {
  const p = contactPointWorld(frames, name);
  const t = surfaceTarget(name, surface, props, p);
  if (!t) return null;
  return p[t.axis] - t.value;
}

/** Zwei-Knochen-IK: verschiebt das Kettenende um delta, erhält Knochenlängen und Beugerichtung. */
function solveTwoBone(frames: BodyFrames, side: Side, chain: "leg" | "arm", delta: V3): number {
  const [b1, b2] = chain === "leg" ? ([`thigh_${side}`, `shank_${side}`] as const) : ([`upperarm_${side}`, `forearm_${side}`] as const);
  const l1 = chain === "leg" ? DIMS.thigh : DIMS.upperArm;
  const l2 = chain === "leg" ? DIMS.shank : DIMS.forearm;
  const A = frames[b1].origin;
  const M = frames[b2].origin;
  const E = boneToWorld(frames, b2, [0, -l2, 0]);
  let target = vadd(E, delta);
  const toT = vsub(target, A);
  let d = vlen(toT);
  const maxD = l1 + l2 - 0.05;
  if (d > maxD) {
    target = vadd(A, vscale(vnorm(toT), maxD));
    d = maxD;
  }
  d = Math.max(d, Math.abs(l1 - l2) + 0.05);
  const dir = vnorm(vsub(target, A));
  // Beugerichtung aus der aktuellen Lage des Mittelgelenks
  let pole = vsub(M, A);
  pole = vsub(pole, vscale(dir, vdot(pole, dir)));
  if (vlen(pole) < 1e-6) pole = vcross(dir, [0, 0, 1]);
  const pn = vnorm(pole);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const M2 = vadd(vadd(A, vscale(dir, a)), vscale(pn, h));

  const rot1 = rotateBetween(vsub(M, A), vsub(M2, A));
  const rot2 = rotateBetween(vsub(E, M), vsub(target, M2));
  const footFrame = chain === "leg" ? frames[`foot_${side}`] : null;
  frames[b1] = { origin: A, R: mmul(rot1, frames[b1].R) };
  frames[b2] = { origin: M2, R: mmul(rot2, frames[b2].R) };
  if (footFrame) {
    // Fuß behält seine Ausrichtung im Raum (bleibt flach), sitzt am neuen Sprunggelenk
    frames[`foot_${side}`] = { origin: boneToWorld(frames, b2, [0, -l2, 0]), R: footFrame.R };
  }
  return vlen(delta);
}

/** Löst eine Pose: Becken auf die Kontakte setzen, Hände/Füße per IK nachführen. */
export function solvePose(pose: Pose3d, props: Prop3d[]): SolvedPose {
  const root: V3 = [pose.root?.x ?? 0, pose.root?.y ?? DIMS.pelvisHeight, pose.root?.z ?? 0];
  let frames = forwardKinematics(pose.joints as JointAngles, root);
  const entries = Object.entries(pose.contacts) as [ContactPointName, string][];
  let ikCorrection = 0;

  if (entries.length > 0) {
    // 1. Becken verschieben: vertikal (Boden/Box) und horizontal (Wand)
    const vertFixed: number[] = [],
      vertIk: number[] = [],
      wall: number[] = [];
    for (const [name, surface] of entries) {
      const p = contactPointWorld(frames, name);
      const t = surfaceTarget(name, surface, props, p);
      if (!t) continue;
      const res = p[t.axis] - t.value;
      if (t.axis === 0) wall.push(res);
      else if (IK_CONTACTS[name]) vertIk.push(res);
      else vertFixed.push(res);
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const dy = vertFixed.length ? -mean(vertFixed) : vertIk.length ? -mean(vertIk) : 0;
    const dx = wall.length ? -mean(wall) : 0;
    root[1] += dy;
    root[0] += dx;
    frames = forwardKinematics(pose.joints as JointAngles, root);

    // 2. Hände/Füße per IK nachführen (mehrere Durchgänge)
    for (let pass = 0; pass < 3; pass++) {
      const perChain = new Map<string, { chain: "leg" | "arm"; side: Side; res: number[] }>();
      for (const [name, surface] of entries) {
        const ik = IK_CONTACTS[name];
        if (!ik) continue;
        const p = contactPointWorld(frames, name);
        const t = surfaceTarget(name, surface, props, p);
        if (!t || t.axis !== 1) continue;
        const key = `${ik.chain}_${ik.side}`;
        const e = perChain.get(key) ?? { chain: ik.chain, side: ik.side, res: [] };
        e.res.push(p[1] - t.value);
        perChain.set(key, e);
      }
      for (const e of perChain.values()) {
        const r = mean(e.res);
        if (Math.abs(r) < 0.05) continue;
        const moved = solveTwoBone(frames, e.side, e.chain, [0, -r, 0]);
        if (pass === 0) ikCorrection = Math.max(ikCorrection, moved);
      }
    }
  }

  const contacts: ContactResult[] = entries.map(([point, surface]) => ({
    point,
    surface,
    residual: residualOf(frames, point, surface, props) ?? 0,
  }));
  return { frames, contacts, ikCorrection, activation: { ...(pose.activation ?? {}) } };
}

/* ---------- Zeitleiste ---------- */

/** Quadratisches Ein- und Ausblenden (wie die 2D-Engine). */
export function ease(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
}

/** Dauer eines Durchgangs (s): alle Übergänge + Haltezeiten. */
export function cycleDuration(def: Pick<Exercise3dDefinition, "keyframes">): number {
  return def.keyframes.reduce((s, k) => s + k.toNextSec + k.holdSec, 0);
}

export interface TimelinePoint {
  /** Position im Bildablauf: i + Anteil (0 … n), n = zurück bei Bild 0 */
  at: number;
  /** Index des Schlüsselbilds, dessen Beschriftung gilt */
  labelIndex: number;
  holding: boolean;
}

/**
 * Zeitpunkt tau (s) → Position. Ablauf: Bild 0 → 1 → … → n−1 → 0; nach jedem
 * Übergang die Haltezeit des erreichten Bilds.
 */
export function timelineAt3d(def: Pick<Exercise3dDefinition, "keyframes">, tau: number): TimelinePoint {
  const ks = def.keyframes;
  const n = ks.length;
  const total = cycleDuration(def);
  let t = ((tau % total) + total) % total;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    if (t < ks[i].toNextSec) return { at: i + ease(t / ks[i].toNextSec), labelIndex: next, holding: false };
    t -= ks[i].toNextSec;
    if (t < ks[next].holdSec) return { at: i + 1, labelIndex: next, holding: true };
    t -= ks[next].holdSec;
  }
  return { at: 0, labelIndex: 0, holding: true };
}

function lerpAngles(a: JointAngles, b: JointAngles, u: number): JointAngles {
  const out: JointAngles = {};
  const joints = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<JointName>;
  for (const j of joints) {
    const da = a[j] ?? {},
      db = b[j] ?? {};
    const dofs = new Set([...Object.keys(da), ...Object.keys(db)]);
    const o: Record<string, number> = {};
    for (const dof of dofs) o[dof] = (da[dof] ?? 0) + ((db[dof] ?? 0) - (da[dof] ?? 0)) * u;
    out[j] = o;
  }
  return out;
}

/** Pose an Position at (0 … n): Winkel, Wurzel, Aktivierung gemischt; gemeinsame Kontakte. */
export function poseAt(def: Pick<Exercise3dDefinition, "keyframes">, at: number): Pose3d {
  const ks = def.keyframes;
  const n = ks.length;
  const clamped = Math.min(Math.max(at, 0), n);
  const i = Math.min(Math.floor(clamped), n - 1);
  const u = clamped - i;
  const a = ks[i],
    b = ks[(i + 1) % n];
  if (u < 1e-9) return { joints: a.joints, root: a.root, contacts: a.contacts, activation: a.activation };
  if (u > 1 - 1e-9) return { joints: b.joints, root: b.root, contacts: b.contacts, activation: b.activation };
  const contacts: Record<string, string> = {};
  for (const [k, s] of Object.entries(a.contacts)) if (b.contacts[k] === s) contacts[k] = s;
  const act: Record<string, number> = {};
  for (const k of new Set([...Object.keys(a.activation ?? {}), ...Object.keys(b.activation ?? {})]))
    act[k] = (a.activation?.[k] ?? 0) + ((b.activation?.[k] ?? 0) - (a.activation?.[k] ?? 0)) * u;
  const root =
    a.root || b.root
      ? {
          x: (a.root?.x ?? 0) + ((b.root?.x ?? 0) - (a.root?.x ?? 0)) * u,
          z: (a.root?.z ?? 0) + ((b.root?.z ?? 0) - (a.root?.z ?? 0)) * u,
        }
      : undefined;
  return { joints: lerpAngles(a.joints as JointAngles, b.joints as JointAngles, u) as Pose3d["joints"], root, contacts, activation: act };
}
