/**
 * Baut das Körpermodell für den 3D-Viewer aus dem Blender-Export
 * (scripts/body-model/export_blender.py → body_L1.json).
 *
 *   npx tsx scripts/body-model/build.ts <body_L1.json> public/models/body.bin
 *
 * Quelle: Blender „Human Base Meshes“ v1.4.1 (realistic_body_male), CC0.
 * Schritte: Achsen/Skalierung → Ruhepose des Skeletts (A-Haltung des Modells)
 * → Skinning-Gewichte je Eckpunkt → Kleidungsbereiche → Muskelzonen → Binärdatei.
 */
import fs from "node:fs";
import { forwardKinematics, type BodyFrames } from "../../src/domain/exercises/body3d/kinematics";
import { buildScene, type MusclePrim } from "../../src/domain/exercises/body3d/scene";
import { DIMS, type BoneName } from "../../src/domain/exercises/body3d/skeleton";
import { mapply, vdot, vlen, vnorm, vsub, type M3, type V3 } from "../../src/domain/exercises/body3d/math";
import type { Exercise3dDefinition, JointAngles } from "../../src/domain/exercises/body3d/schema";
import { BODY_BONES, BODY_REGIONS, BODY_REST_POSE, BODY_MODEL_MAGIC } from "../../src/domain/exercises/body3d/bodyModel";

const [, , input, output] = process.argv;
if (!input || !output) throw new Error("Aufruf: build.ts <body_L1.json> <ausgabe.bin>");
const raw = JSON.parse(fs.readFileSync(input, "utf8")) as Record<string, { positions: number[]; triangles: number[] }>;

/* ---------- 1. Achsen: Blender (Z oben, Blick −Y) → unsere (x vorn, y oben, z rechts), cm ---------- */
const SCALE = 104; // m → cm, Modell 168 cm → 175 cm
const Z_SHIFT = -226.4 * 1.04; // Objekt steht bei x = −2,264 m
const toOurs = (x: number, y: number, z: number): V3 => [-y * SCALE, z * SCALE, -x * SCALE + Z_SHIFT];

const parts = [raw.body, raw.eye_L, raw.eye_R];
const V: V3[] = [];
const tris: number[] = [];
const isEye: boolean[] = [];
parts.forEach((p, pi) => {
  const base = V.length;
  for (let i = 0; i < p.positions.length; i += 3) {
    V.push(toOurs(p.positions[i], p.positions[i + 1], p.positions[i + 2]));
    isEye.push(pi > 0);
  }
  for (const t of p.triangles) tris.push(base + t);
});
const n = V.length;
console.log("Eckpunkte", n, "Dreiecke", tris.length / 3);

/* ---------- 2. Ruhepose ---------- */
const rest: BodyFrames = forwardKinematics(BODY_REST_POSE as JointAngles, [0, DIMS.pelvisHeight, 0]);
const end = (b: BoneName, len: number): V3 => {
  const f = rest[b];
  return [f.origin[0] - f.R[1] * len, f.origin[1] - f.R[4] * len, f.origin[2] - f.R[7] * len];
};
const fmt = (p: V3) => p.map((x) => x.toFixed(1)).join(",");
console.log("Ruhepose Knie r", fmt(rest.shank_r.origin), "Fuß r", fmt(rest.foot_r.origin), "Ellbogen r", fmt(rest.forearm_r.origin), "Hand r", fmt(end("forearm_r", DIMS.forearm)));

/* ---------- 3. Skinning-Gewichte ---------- */
/** Höhe der Achsel (cm): darunter sind Rumpf und Arm im Modell getrennt. */
const ARMPIT_Y = 123;
/** Halbe Rumpfbreite (z) je Höhe unterhalb der Achsel, aus dem Modell gemessen. */
const TRUNK_W: [number, number][] = [[80, 17], [100, 16.1], [104, 15.6], [110, 15.2], [114, 15.8], [118, 17], [122, 17.9], [124, 18.5]];
function trunkHalfWidth(y: number): number {
  if (y <= TRUNK_W[0][0]) return TRUNK_W[0][1];
  for (let i = 1; i < TRUNK_W.length; i++)
    if (y <= TRUNK_W[i][0]) {
      const [y0, w0] = TRUNK_W[i - 1],
        [y1, w1] = TRUNK_W[i];
      return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0);
    }
  return TRUNK_W[TRUNK_W.length - 1][1];
}
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};
const boneIdx = (b: BoneName) => BODY_BONES.indexOf(b);
const W: Map<number, number>[] = [];
const cls: ("arm" | "leg" | "torso")[] = [];
/** Abstand eines Punkts zur Strecke a→b */
const segDist = (p: V3, a: V3, b: V3) => {
  const ab = vsub(b, a);
  const t = Math.min(Math.max(vdot(vsub(p, a), ab) / vdot(ab, ab), 0), 1);
  return vlen(vsub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]));
};
const along = (p: V3, b: BoneName) => {
  const f = rest[b];
  const d: V3 = [-f.R[1], -f.R[4], -f.R[7]]; // Knochen zeigt entlang −y
  const rel = vsub(p, f.origin);
  const t = vdot(rel, d);
  const perp = vlen(vsub(rel, [d[0] * t, d[1] * t, d[2] * t]));
  return { t, perp };
};

for (let i = 0; i < n; i++) {
  const p = V[i];
  const w = new Map<number, number>();
  const add = (b: BoneName, x: number) => x > 1e-4 && w.set(boneIdx(b), (w.get(boneIdx(b)) ?? 0) + x);
  if (isEye[i]) {
    add("neck", 1);
    W.push(w);
    continue;
  }
  const side = p[2] >= 0 ? "r" : "l";
  const s = side === "r" ? 1 : -1;
  // Arm? (A-Haltung: seitlich vom Rumpf, entlang der Oberarmachse)
  const ua = along(p, `upperarm_${side}`);
  const S = rest[`upperarm_${side}`].origin,
    E = rest[`forearm_${side}`].origin,
    Hd = end(`forearm_${side}`, DIMS.forearm + DIMS.hand + 4);
  // Oberarm eng (Radius ~7 cm, an der Schulterkappe oben etwas mehr), damit
  // Achsel und seitlicher Brustkorb am Rumpf bleiben
  const upperR = segDist(p, S, E);
  const capTop = ua.t < 7 && p[1] > S[1] - 3 ? 2.5 : 0;
  const armDist = Math.min(upperR - capTop, segDist(p, E, Hd));
  const legDist = Math.min(
    segDist(p, rest[`thigh_${side}`].origin, rest[`shank_${side}`].origin) - 4,
    segDist(p, rest[`shank_${side}`].origin, rest[`foot_${side}`].origin),
  );
  // Rumpf/Arm-Trennung über die gemessene Rumpfbreite (unterhalb der Achsel)
  // bzw. die Brustbreite (darüber); die Schulterkappe oben gehört zum Arm
  const outsideTrunk = Math.abs(p[2]) > (p[1] < ARMPIT_Y ? trunkHalfWidth(p[1]) + 0.3 : 19.5) || (p[1] > S[1] - 2 && upperR < 9);
  const armReach =
    ua.t > -4 && Math.abs(p[2]) > 13 && outsideTrunk && (armDist < 7 || (segDist(p, E, Hd) < 12 && armDist < legDist - 1));
  // Bein? unterhalb des Schritts, oder Gesäß/Hüfte knapp darüber
  const crotch = 79;
  const legShare = 1 - smooth(crotch - 3, crotch + 11, p[1]);
  cls[i] = armReach ? "arm" : legShare > 0.5 && Math.abs(p[2]) > 0.5 ? "leg" : "torso";
  if (armReach) {
    const fa = along(p, `forearm_${side}`);
    const fw = smooth(-3, 3, fa.t);
    // Übergang Schulter: Achselnähe (weiter weg von der Achse) folgt mehr dem Rumpf
    const armW = smooth(-3, 8, ua.t) * (1 - 0.6 * smooth(4.5, 7, upperR) * (1 - smooth(6, 14, ua.t)));
    add(`upperarm_${side}`, armW * (1 - fw));
    add(`forearm_${side}`, armW * fw);
    add("spine_up", 1 - armW);
  } else if (legShare > 0 && Math.abs(p[2]) > 0.5) {
    const sh = along(p, `shank_${side}`);
    const kneeW = smooth(-4, 4, sh.t);
    const footW = smooth(rest[`foot_${side}`].origin[1] + 1.5, rest[`foot_${side}`].origin[1] - 2.5, p[1]) * smooth(-14, -8, p[0] - rest[`foot_${side}`].origin[0] + 10);
    const footShare = Math.max(footW, p[1] < 4 ? 1 : 0);
    const legW = legShare;
    add(`thigh_${side}`, legW * (1 - kneeW));
    add(`shank_${side}`, legW * kneeW * (1 - footShare));
    add(`foot_${side}`, legW * kneeW * footShare);
    add("pelvis", 1 - legW);
  } else {
    // Rumpf/Kopf nach Höhe
    const y = p[1];
    const neckW = smooth(147, 154, y) * (1 - smooth(9, 13, Math.abs(p[2])));
    const upW = smooth(113, 125, y);
    const lowW = smooth(99, 108, y);
    add("neck", neckW);
    const rem = 1 - neckW;
    add("spine_up", rem * upW);
    add("spine_low", rem * (1 - upW) * lowW);
    add("pelvis", rem * (1 - upW) * (1 - lowW));
  }
  void s;
  W.push(w);
}

// Glätten über die Nachbarschaft (weiche Übergänge an den Gelenken)
const nbr: Set<number>[] = Array.from({ length: n }, () => new Set());
for (let t = 0; t < tris.length; t += 3) {
  const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
  nbr[a].add(b).add(c);
  nbr[b].add(a).add(c);
  nbr[c].add(a).add(b);
}
let cur = W;
for (let it = 0; it < 6; it++) {
  const next: Map<number, number>[] = [];
  for (let i = 0; i < n; i++) {
    const acc = new Map<number, number>();
    const addAll = (m: Map<number, number>, k: number) => m.forEach((x, b) => acc.set(b, (acc.get(b) ?? 0) + x * k));
    addAll(cur[i], 1);
    const ns = [...nbr[i]];
    for (const j of ns) addAll(cur[j], 1 / ns.length);
    let sum = 0;
    acc.forEach((x) => (sum += x));
    acc.forEach((x, b) => acc.set(b, x / sum));
    next.push(acc);
  }
  cur = next;
}

const skinIndex = new Uint8Array(n * 4);
const skinWeight = new Uint8Array(n * 4);
for (let i = 0; i < n; i++) {
  const top = [...cur[i].entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((a, [, x]) => a + x, 0);
  // auf 255 quantisieren, Rundungsrest dem stärksten Knochen geben
  const q = top.map(([, x]) => Math.floor((x / sum) * 255));
  q[0] += 255 - q.reduce((a, b) => a + b, 0);
  top.forEach(([b], k) => {
    skinIndex[i * 4 + k] = b;
    skinWeight[i * 4 + k] = q[k];
  });
}

/* ---------- 4. Kleidung ---------- */
/** Kurzhaarschnitt: Haaransatz vorn hoch, an den Seiten über den Ohren, hinten tief. */
function isHair(p: V3): boolean {
  const [x, y, z] = p;
  const line = x > 5 ? 170 : x > 0 ? 170 - (5 - x) * 0.9 : x > -5 ? 165.5 - -x * 1.3 : 157;
  const ear = Math.abs(z) > 6.8 && y < 166.5 && x > -6;
  return y > line && !ear;
}
const region = new Uint8Array(n);
const R = BODY_REGIONS;
const dominant = (i: number) => [...cur[i].entries()].sort((a, b) => b[1] - a[1])[0][0];
for (let i = 0; i < n; i++) {
  const p = V[i];
  const c = cls[i];
  const side = p[2] >= 0 ? "r" : "l";
  const neckline = 146 - (p[0] > 0 ? 4 * (1 - Math.min(Math.abs(p[2]) / 8, 1)) : 0);
  if (isEye[i]) region[i] = R.eye;
  else if (c === "leg" && (p[1] < 9.5 || BODY_BONES[dominant(i)].startsWith("foot"))) region[i] = R.shoe;
  else if ((c === "leg" && p[1] > 64) || (c === "torso" && p[1] < 104)) region[i] = R.shorts;
  else if (c === "arm") {
    // Ärmel bis 11 cm unter der Schulter; Rumpfseite (weiter weg von der Armachse) bleibt Shirt
    const S = rest[`upperarm_${side}`].origin,
      E = rest[`forearm_${side}`].origin;
    const torsoSide = p[1] > 104 && segDist(p, S, E) > 6.2 && along(p, `upperarm_${side}`).t < 20;
    region[i] = along(p, `upperarm_${side}`).t < 11 || torsoSide ? R.shirt : R.skin;
  }
  else if (c === "torso" && p[1] < neckline) region[i] = R.shirt;
  else if (c === "torso" && isHair(p)) region[i] = R.hair;
  else region[i] = R.skin;
}

/* ---------- 5. Muskelzonen ---------- */
const fakeDef = { props: [], muscles: [] } as unknown as Exercise3dDefinition;
const muscles = buildScene(fakeDef, { joints: BODY_REST_POSE as Exercise3dDefinition["keyframes"][0]["joints"], contacts: {} }, { mode: "muscles" })
  .primitives.filter((p): p is MusclePrim => p.kind === "muscle");
const muscleIds = muscles.map((m) => m.id);

// Normalen der Ruhepose
const normals: V3[] = Array.from({ length: n }, () => [0, 0, 0] as V3);
for (let t = 0; t < tris.length; t += 3) {
  const [a, b, c] = [V[tris[t]], V[tris[t + 1]], V[tris[t + 2]]];
  const e1 = vsub(b, a),
    e2 = vsub(c, a);
  const nn: V3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  for (const k of [tris[t], tris[t + 1], tris[t + 2]]) for (let d = 0; d < 3; d++) normals[k][d] += nn[d];
}
const muscleIndex = new Uint8Array(n * 2).fill(255);
const muscleWeight = new Uint8Array(n * 2);
const tr = (M: M3): M3 => [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]];
for (let i = 0; i < n; i++) {
  if (isEye[i] || region[i] === R.hair) continue;
  const p = V[i];
  const nrm = vnorm(normals[i]);
  const cands: [number, number][] = [];
  muscles.forEach((m, mi) => {
    const l = mapply(tr(m.R), vsub(p, m.center));
    const u = l[1] / m.radii[1];
    if (Math.abs(u) > 1.08) return;
    const prof = Math.sqrt(Math.max(0, 1 - Math.min(u * u, 1)));
    const ex = m.radii[0] * prof,
      ez = m.radii[2] * prof;
    // Abstand von der Spindel in der Querschnittsebene (elliptisch normiert)
    const q = Math.hypot(l[0] / Math.max(ex + 3.5, 0.5), l[2] / Math.max(ez + 3.5, 0.5));
    const outward = vnorm(vsub(p, m.center));
    if (vdot(outward, nrm) < 0.1) return;
    const wgt = (1 - smooth(1.0, 1.6, q)) * (1 - smooth(0.82, 1.08, Math.abs(u)));
    if (wgt > 0.02) cands.push([mi, wgt]);
  });
  cands.sort((a, b) => b[1] - a[1]);
  cands.slice(0, 2).forEach(([mi, wgt], k) => {
    muscleIndex[i * 2 + k] = mi;
    muscleWeight[i * 2 + k] = Math.round(Math.min(wgt, 1) * 255);
  });
}

/* ---------- 6. Ruhe-Matrizen (für boneInverses) ---------- */
const restMatrices = BODY_BONES.map((b) => {
  const f = rest[b];
  // Spaltenweise 4×4 (three.js Matrix4.fromArray)
  return [f.R[0], f.R[3], f.R[6], 0, f.R[1], f.R[4], f.R[7], 0, f.R[2], f.R[5], f.R[8], 0, f.origin[0], f.origin[1], f.origin[2], 1].map((x) => +x.toFixed(6));
});

/* ---------- 7. Schreiben ---------- */
const pos = new Int16Array(n * 3);
V.forEach((p, i) => p.forEach((x, d) => (pos[i * 3 + d] = Math.round(x * 100))));
const idx = n < 65536 ? new Uint16Array(tris) : new Uint32Array(tris);
const blocks: [string, ArrayBufferView][] = [
  ["position", pos],
  ["index", idx],
  ["skinIndex", skinIndex],
  ["skinWeight", skinWeight],
  ["muscleIndex", muscleIndex],
  ["muscleWeight", muscleWeight],
  ["region", region],
];
let offset = 0;
const layout: Record<string, { offset: number; length: number; type: string }> = {};
for (const [name, arr] of blocks) {
  offset = Math.ceil(offset / 4) * 4;
  layout[name] = { offset, length: arr.byteLength, type: arr.constructor.name };
  offset += arr.byteLength;
}
const header = JSON.stringify({
  version: 1,
  source: "Blender Human Base Meshes v1.4.1 – realistic_body_male (CC0)",
  vertexCount: n,
  indexCount: tris.length,
  positionScale: 0.01,
  bones: BODY_BONES,
  restMatrices,
  muscles: muscleIds,
  layout,
});
const hb = Buffer.from(header, "utf8");
const headLen = Math.ceil((8 + hb.length) / 4) * 4;
const out = Buffer.alloc(headLen + offset);
out.write(BODY_MODEL_MAGIC, 0, "ascii");
out.writeUInt32LE(hb.length, 4);
hb.copy(out, 8);
for (const [name, arr] of blocks) Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).copy(out, headLen + layout[name].offset);
fs.writeFileSync(output, out);
const regCount = Object.entries(R).map(([k, v]) => `${k}=${region.filter((x) => x === v).length}`).join(" ");
console.log("geschrieben", output, (out.length / 1024).toFixed(0), "KB;", regCount, "; Muskeln", muscleIds.length, "; Eckpunkte mit Muskel", muscleIndex.filter((x, i) => i % 2 === 0 && x !== 255).length);
