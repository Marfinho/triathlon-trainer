import { escapeXml } from "../engine/escape";
import { vcross, vdot, vnorm, type M3, type V3 } from "./math";
import { buildScene, type Capsule, type Ellipsoid, type MusclePrim, type Primitive } from "./scene";
import { MUSCLES } from "./muscles";
import type { BodyFrames } from "./kinematics";
import { poseAt } from "./kinematics";
import type { Exercise3dDefinition, Pose3d, Prop3d, View3d } from "./schema";

/**
 * Flache (orthografische) SVG-Darstellung der 3D-Szene – für Listen, den
 * Ablauf in vier Bildern, das Fehlerbild, den Druck und Geräte ohne WebGL.
 * Deterministisch; Zahlen mit einer Nachkommastelle, Texte XML-escaped.
 */

const W = 200,
  H = 160;
const f1 = (x: number) => x.toFixed(1);

interface Basis {
  right: V3;
  up: V3;
  toCam: V3;
}

export function viewBasis(view: View3d): Basis {
  const c: Record<View3d, V3> = {
    side: [0, 0, 1],
    front: [1, 0, 0],
    back: [-1, 0, 0],
    three_quarter: vnorm([0.7, 0.32, 0.64]),
    top: [0, 1, 0],
  };
  const toCam = c[view];
  const up0: V3 = view === "top" ? [1, 0, 0] : [0, 1, 0];
  const right = vnorm(vcross(up0, toCam));
  const up = vcross(toCam, right);
  return { right, up, toCam };
}

const proj = (b: Basis, p: V3): [number, number, number] => [vdot(p, b.right), vdot(p, b.up), vdot(p, b.toCam)];

/** Umriss eines projizierten Ellipsoids: Halbachsen und Winkel (Grad). */
function projectEllipsoid(b: Basis, R: M3, radii: V3): { rx: number; ry: number; angle: number } {
  // J = [right; up] · R · diag(radii)
  const J: number[][] = [b.right, b.up].map((row) =>
    [0, 1, 2].map((k) => (row[0] * R[k] + row[1] * R[3 + k] + row[2] * R[6 + k]) * radii[k]),
  );
  const a = J[0][0] ** 2 + J[0][1] ** 2 + J[0][2] ** 2;
  const d = J[1][0] ** 2 + J[1][1] ** 2 + J[1][2] ** 2;
  const c = J[0][0] * J[1][0] + J[0][1] * J[1][1] + J[0][2] * J[1][2];
  const tr = (a + d) / 2,
    disc = Math.sqrt(Math.max(0, ((a - d) / 2) ** 2 + c * c));
  const l1 = tr + disc,
    l2 = Math.max(tr - disc, 0);
  const angle = (Math.atan2(l1 - a, c || 1e-12) * 180) / Math.PI;
  return { rx: Math.sqrt(l1), ry: Math.sqrt(l2), angle: Math.abs(c) < 1e-9 ? (a >= d ? 0 : 90) : angle };
}

interface Fit {
  scale: number;
  ox: number;
  oy: number;
}

function hull(points: [number, number][]): [number, number][] {
  const p = [...points].sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [],
    upper: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function propCorners(p: Prop3d): V3[] | null {
  if (p.type === "box") {
    const d = p.d ?? 40,
      z = p.z ?? 0;
    const xs = [p.x - p.w / 2, p.x + p.w / 2],
      ys = [0, p.h],
      zs = [z - d / 2, z + d / 2];
    return xs.flatMap((x) => ys.flatMap((y) => zs.map((zz) => [x, y, zz] as V3)));
  }
  if (p.type === "wall") {
    return [0, 200].flatMap((y) => [-70, 70].flatMap((z) => [p.x, p.x + 6].map((x) => [x, y, z] as V3)));
  }
  return null;
}

/** Bildausschnitt: Körper aller Schlüsselbilder (und Fehlerbild) + Requisiten. */
function fitFor(def: Exercise3dDefinition, b: Basis): Fit {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  const poses: Pose3d[] = [...def.keyframes, ...(def.fault ? [def.fault.pose] : [])];
  for (const pose of poses) {
    for (const p of buildScene(def, pose).primitives) {
      const pts: V3[] = p.kind === "capsule" ? [p.a, p.b] : [p.center];
      const r = p.kind === "capsule" ? Math.max(p.ra, p.rb) : Math.max(...p.radii);
      for (const q of pts) {
        const s = proj(b, q);
        add(s[0] - r, s[1] - r);
        add(s[0] + r, s[1] + r);
      }
    }
  }
  for (const p of def.props) {
    const cs = propCorners(p);
    if (cs) for (const c of cs) {
      const s = proj(b, c);
      if (p.type === "wall") add(s[0], s[1] > maxY ? maxY : s[1]);
      else add(s[0], s[1]);
    }
  }
  const floor = proj(b, [0, 0, 0])[1];
  if (b.toCam[1] < 0.9) minY = Math.min(minY, floor);
  const pad = 10;
  const scale = Math.min((W - 2 * pad) / Math.max(maxX - minX, 1), (H - 2 * pad) / Math.max(maxY - minY, 1));
  const ox = W / 2 - ((minX + maxX) / 2) * scale;
  const oy = H / 2 + ((minY + maxY) / 2) * scale;
  return { scale, ox, oy };
}

const fitCache = new WeakMap<object, Map<View3d, Fit>>();
function cachedFit(def: Exercise3dDefinition, view: View3d, b: Basis): Fit {
  let m = fitCache.get(def);
  if (!m) fitCache.set(def, (m = new Map()));
  let f = m.get(view);
  if (!f) m.set(view, (f = fitFor(def, b)));
  return f;
}

const PART_CLASS: Record<string, string> = {
  shirt: "c-top",
  pants: "c-leg",
  skin: "c-skin",
  shoe: "c-shoe",
  hair: "c-hair",
};

/** Körpergruppen: werden je Gruppe erst als Kontur, dann gefüllt gezeichnet. */
function groupOf(id: string): string {
  if (/^(thigh|shank|heel|foot)_([lr])$/.test(id)) return `leg_${id.slice(-1)}`;
  if (/^(shoulder|upperarm|forearm|hand)_([lr])$/.test(id)) return `arm_${id.slice(-1)}`;
  if (id === "head" || id === "hair") return "head";
  return "torso";
}

function muscleGroup(m: MusclePrim): string {
  const ins = MUSCLES[m.muscle].insertion.bone as string;
  const side = m.side === "c" ? "r" : m.side;
  if (/^(thigh|shank|foot)/.test(ins)) return `leg_${side}`;
  if (/^(upperarm|forearm)/.test(ins)) return `arm_${side}`;
  return "torso";
}

interface Ctx {
  b: Basis;
  fit: Fit;
}

const sx = (c: Ctx, p: V3): [number, number] => {
  const q = proj(c.b, p);
  return [c.fit.ox + q[0] * c.fit.scale, c.fit.oy - q[1] * c.fit.scale];
};

/** Umriss einer Kapsel als ein geschlossener Pfad (keine Gelenkkreise im Inneren). */
function capsulePath(c: Ctx, p: Capsule): string {
  const [ax, ay] = sx(c, p.a),
    [bx, by] = sx(c, p.b);
  const ra = p.ra * c.fit.scale,
    rb = p.rb * c.fit.scale;
  const dx = bx - ax,
    dy = by - ay,
    d = Math.hypot(dx, dy);
  if (d < 0.01) return `<circle cx="${f1(ax)}" cy="${f1(ay)}" r="${f1(Math.max(ra, rb))}"/>`;
  const nx = -dy / d,
    ny = dx / d;
  return (
    `<path d="M${f1(ax + nx * ra)},${f1(ay + ny * ra)} L${f1(bx + nx * rb)},${f1(by + ny * rb)} ` +
    `A${f1(rb)},${f1(rb)} 0 0 0 ${f1(bx - nx * rb)},${f1(by - ny * rb)} L${f1(ax - nx * ra)},${f1(ay - ny * ra)} ` +
    `A${f1(ra)},${f1(ra)} 0 0 0 ${f1(ax + nx * ra)},${f1(ay + ny * ra)} Z"/>`
  );
}

function ellipseEl(c: Ctx, center: V3, R: M3, radii: V3, extra = ""): string {
  const [cx, cy] = sx(c, center);
  const e = projectEllipsoid(c.b, R, radii);
  const rot = f1(-e.angle);
  return `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(Math.max(e.rx * c.fit.scale, 0.3))}" ry="${f1(Math.max(e.ry * c.fit.scale, 0.3))}" transform="rotate(${rot} ${f1(cx)} ${f1(cy)})"${extra}/>`;
}

function shapeOf(c: Ctx, p: Capsule | Ellipsoid): string {
  return p.kind === "capsule" ? capsulePath(c, p) : ellipseEl(c, p.center, p.R, p.radii);
}

const centerOf = (p: Primitive): V3 =>
  p.kind === "capsule" ? [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2] : p.center;

function muscleFill(m: MusclePrim): number {
  return m.role === "stretch"
    ? Math.min(1, 0.4 + Math.max(0, m.stretch - 1) * 3 + m.activation * 0.3)
    : m.role === "idle"
      ? 0.55
      : 0.3 + 0.7 * m.activation;
}

/** Zeichnet Körper + Muskeln: Gruppen nach Tiefe, je Gruppe Kontur, Füllung, sichtbare Muskeln. */
function bodySvg(c: Ctx, prims: Primitive[], frames: BodyFrames, ghost: boolean): string {
  const groups = new Map<string, { parts: (Capsule | Ellipsoid)[]; muscles: MusclePrim[] }>();
  const get = (k: string) => {
    let g = groups.get(k);
    if (!g) groups.set(k, (g = { parts: [], muscles: [] }));
    return g;
  };
  for (const p of prims) {
    if (p.kind === "muscle") {
      if (!ghost) get(muscleGroup(p)).muscles.push(p);
    } else get(groupOf(p.id)).parts.push(p);
  }
  const depthOf = (pts: V3[]) => pts.reduce((a, q) => a + proj(c.b, q)[2], 0) / Math.max(pts.length, 1);
  const order = [...groups.entries()].sort(
    (x, y) => depthOf(x[1].parts.map(centerOf)) - depthOf(y[1].parts.map(centerOf)) || (x[0] < y[0] ? -1 : 1),
  );
  let out = "";
  for (const [, g] of order) {
    const parts = [...g.parts].sort((x, y) => proj(c.b, centerOf(x))[2] - proj(c.b, centerOf(y))[2]);
    if (ghost) {
      out += parts.map((p) => shapeOf(c, p)).join("");
      continue;
    }
    out += `<g class="b3o">${parts.map((p) => shapeOf(c, p)).join("")}</g>`;
    for (const p of parts) out += `<g class="${PART_CLASS[p.part]}">${shapeOf(c, p)}</g>`;
    for (const m of [...g.muscles].sort((x, y) => proj(c.b, x.center)[2] - proj(c.b, y.center)[2])) {
      // nur Muskeln auf der dem Betrachter zugewandten Seite ihres Knochens
      const host = frames[(MUSCLES[m.muscle].origin.bone as string).replace("*", m.side === "c" ? "r" : m.side) as keyof BodyFrames].origin;
      const ins = frames[(MUSCLES[m.muscle].insertion.bone as string).replace("*", m.side === "c" ? "r" : m.side) as keyof BodyFrames].origin;
      const axisMid: V3 = [(host[0] + ins[0]) / 2, (host[1] + ins[1]) / 2, (host[2] + ins[2]) / 2];
      const facing = vdot([m.center[0] - axisMid[0], m.center[1] - axisMid[1], m.center[2] - axisMid[2]], c.b.toCam);
      if (facing < -0.5 && m.role === "idle") continue;
      if (facing < -2) continue;
      out += ellipseEl(c, m.center, m.R, m.radii, ` class="b3m ${m.role}" fill-opacity="${muscleFill(m).toFixed(2)}"`);
    }
  }
  return ghost ? `<g class="gh3">${out}</g>` : out;
}

function propsSvg(def: Exercise3dDefinition, b: Basis, fit: Fit): string {
  let s = "";
  for (const p of def.props) {
    const cs = propCorners(p);
    if (!cs) continue;
    const pts = hull(cs.map((c) => {
      const q = proj(b, c);
      return [fit.ox + q[0] * fit.scale, fit.oy - q[1] * fit.scale] as [number, number];
    }));
    s += `<path class="prop" d="M${pts.map((q) => `${f1(q[0])},${f1(q[1])}`).join(" L")} Z"/>`;
  }
  return s;
}

export interface FlatOptions {
  view?: View3d;
  mode?: "body" | "muscles";
  numbers?: boolean;
  ghost?: Pose3d | null;
  label: string;
}

/** Eine Pose als SVG (viewBox 0 0 200 160). */
export function renderPose3dSvg(def: Exercise3dDefinition, pose: Pose3d, opts: FlatOptions): string {
  const view = opts.view ?? def.view;
  const b = viewBasis(view);
  const fit = cachedFit(def, view, b);
  const c: Ctx = { b, fit };
  const scene = buildScene(def, pose, { mode: opts.mode });
  const prims = scene.primitives;
  const depth = (p: Primitive) => proj(b, centerOf(p))[2];
  let ghost = "";
  if (opts.ghost) {
    const g = buildScene(def, opts.ghost);
    ghost = bodySvg(c, g.primitives.filter((p) => p.kind !== "muscle"), g.frames, true);
  }
  const floorY = f1(fit.oy);
  const ground = b.toCam[1] < 0.9 ? `<line class="gnd" x1="0" y1="${floorY}" x2="${W}" y2="${floorY}"/>` : "";
  let numbers = "";
  if (opts.numbers) {
    const placed: [number, number][] = [];
    def.muscles.forEach((m, i) => {
      const base = m.id.replace(/_[lr]$/, "");
      const side = /_l$/.test(m.id) ? "l" : /_r$/.test(m.id) ? "r" : null;
      const cands = prims.filter((p) => p.kind === "muscle" && p.muscle === base && (!side || p.side === side));
      const near = cands.sort((a, c) => depth(c) - depth(a))[0];
      if (!near || near.kind !== "muscle") return;
      const C = proj(b, near.center);
      let x = fit.ox + C[0] * fit.scale,
        y = fit.oy - C[1] * fit.scale;
      for (let k = 0; k < 6 && placed.some((q) => Math.hypot(q[0] - x, q[1] - y) < 10); k++) y += 10;
      placed.push([x, y]);
      x = Math.min(Math.max(x, 6), W - 6);
      const kind = m.role === "stretch" ? "stretch" : "work";
      numbers += `<circle class="mk-c ${kind}" cx="${f1(x)}" cy="${f1(y)}" r="4.6"/><text class="mk-t ${kind}" x="${f1(x)}" y="${f1(y + 0.3)}">${i + 1}</text>`;
    });
  }
  return (
    `<svg class="fig b3fig" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(opts.label)}" xmlns="http://www.w3.org/2000/svg">` +
    ground +
    propsSvg(def, b, fit) +
    ghost +
    bodySvg(c, prims, scene.frames, false) +
    numbers +
    `</svg>`
  );
}

/** Schlüsselbild mit der höchsten Muskelaktivierung (für das Muskelbild). */
export function heroKeyframe(def: Exercise3dDefinition): number {
  let best = 0,
    score = -1;
  def.keyframes.forEach((k, i) => {
    const s = Object.values(k.activation ?? {}).reduce((a, x) => a + x, 0);
    if (s > score) {
      score = s;
      best = i;
    }
  });
  return best;
}

export function renderHero3dSvg(def: Exercise3dDefinition): string {
  return renderPose3dSvg(def, def.keyframes[heroKeyframe(def)], { numbers: true, label: `Zielmuskeln bei ${def.title}` });
}

export function renderThumb3dSvg(def: Exercise3dDefinition): string {
  return renderPose3dSvg(def, def.keyframes[heroKeyframe(def)], { label: def.title });
}

export function renderFrame3dSvg(def: Exercise3dDefinition, index: number): string {
  const fr = def.frames[index];
  if (!fr) throw new RangeError(`Bild ${index} existiert nicht (0–3).`);
  const pose = poseAt(def, fr.at);
  const ghostIdx = fr.at === 0 ? null : Number.isInteger(fr.at) ? fr.at - 1 : Math.floor(fr.at);
  return renderPose3dSvg(def, pose, {
    ghost: ghostIdx === null ? null : def.keyframes[ghostIdx],
    label: `${def.title}, Bild ${index + 1}: ${fr.label}`,
  });
}

export function renderFault3dSvg(def: Exercise3dDefinition): string | null {
  if (!def.fault) return null;
  return renderPose3dSvg(def, def.fault.pose, { label: `Häufiger Fehler bei ${def.title}` });
}
