/* Entwicklungshilfe: sucht Gelenkwinkel, mit denen eine 3D-Übung die Prüfung besteht.
 * Aufruf: tsx scripts/dev/fit3d.ts <bibliothek.json> <übungs-id> <spec.json> [iterationen]
 * spec: { "params": [{ "path": "keyframes.0.joints.pelvis.roll", "min": -95, "max": -70, "tie": ["keyframes.1.joints.pelvis.roll"] }] }
 * Pfade ohne vorhandene Zwischenobjekte werden angelegt. Schreibt die Datei mit den besten Werten zurück. */
import fs from "node:fs";
import { exercise3dDefinitionSchema } from "../../src/domain/exercises/body3d/schema";
import { JOINTS } from "../../src/domain/exercises/body3d/skeleton";
import { validateExercise3d } from "../../src/domain/exercises/body3d/validate";

type Param = { path: string; min: number; max: number; tie?: string[] };
const [file, id, specFile, itArg] = process.argv.slice(2);
const list = JSON.parse(fs.readFileSync(file, "utf8"));
const idx = list.findIndex((e: { id: string }) => e.id === id);
const spec = JSON.parse(fs.readFileSync(specFile, "utf8")) as {
  params?: Param[];
  /** Automatisch: alle vorhandenen Winkel/root-Werte um ±window (°/cm) variieren, Abweichung wird leicht bestraft. */
  auto?: { window?: number; rootWindow?: number; skip?: string[] };
};
const iterations = Number(itArg) || 3000;

function setPath(obj: Record<string, unknown>, path: string, v: number) {
  const parts = path.split(".");
  let o: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof o[parts[i]] !== "object" || o[parts[i]] === null) o[parts[i]] = {};
    o = o[parts[i]] as Record<string, unknown>;
  }
  o[parts[parts.length - 1]] = v;
}
function getPath(obj: Record<string, unknown>, path: string): number {
  let o: unknown = obj;
  for (const p of path.split(".")) o = (o as Record<string, unknown> | undefined)?.[p];
  return typeof o === "number" ? o : 0;
}
function cost(entry: Record<string, unknown>): number {
  const p = exercise3dDefinitionSchema.safeParse(entry);
  if (!p.success) return 1e6;
  const v = validateExercise3d(p.data);
  let c = 0;
  for (const e of [...v.errors, ...v.warnings]) {
    c += e.code === "EXERCISE_POSE_INVALID" ? 20 : 4;
    for (const m of e.message.matchAll(/(\d+(?:[.,]\d+)?) cm/g)) c += Number(m[1].replace(",", "."));
  }
  return c;
}
function devPenalty(entry: Record<string, unknown>): number {
  let d = 0;
  for (const [path, v] of Object.entries(origin)) d += 0.02 * Math.abs(getPath(entry, path) - v);
  return d;
}
const apply = (entry: Record<string, unknown>, par: Param, v: number) => {
  setPath(entry, par.path, v);
  for (const t of par.tie ?? []) setPath(entry, t, v);
};
const entry = structuredClone(list[idx]);
const origin: Record<string, number> = {};
if (spec.auto) {
  const w = spec.auto.window ?? 20;
  const rw = spec.auto.rootWindow ?? 8;
  const params: Param[] = [];
  const poses: [string, Record<string, unknown>][] = [];
  (entry.keyframes as Record<string, unknown>[]).forEach((k, i) => poses.push([`keyframes.${i}`, k]));
  if (entry.fault) poses.push(["fault.pose", (entry.fault as { pose: Record<string, unknown> }).pose]);
  for (const [base, pose] of poses) {
    const joints = (pose.joints ?? {}) as Record<string, Record<string, number>>;
    for (const [j, dofs] of Object.entries(joints))
      for (const [d, v] of Object.entries(dofs)) {
        const path = `${base}.joints.${j}.${d}`;
        if (spec.auto.skip?.some((s) => path.includes(s))) continue;
        const lim = (JOINTS as Record<string, Record<string, readonly [number, number]>>)[j]?.[d] ?? [-180, 180];
        params.push({ path, min: Math.max(lim[0], v - w), max: Math.min(lim[1], v + w) });
        origin[path] = v;
      }
    const root = (pose.root ?? {}) as Record<string, number>;
    for (const [d, v] of Object.entries(root)) {
      if (d === "y") continue;
      const path = `${base}.root.${d}`;
      params.push({ path, min: v - rw, max: v + rw });
      origin[path] = v;
    }
    if (!pose.root && spec.auto.rootWindow) {
      for (const d of ["x"]) {
        const path = `${base}.root.${d}`;
        params.push({ path, min: -rw, max: rw });
        origin[path] = 0;
      }
    }
  }
  spec.params = params;
}
let best = cost(entry);
const params: Param[] = (spec.params = spec.params ?? []);
const cur = params.map((p) => getPath(entry, p.path));
cur.forEach((v, i) => apply(entry, params[i], v));
best = cost(entry) + devPenalty(entry);
const total = (e: Record<string, unknown>) => cost(e) + devPenalty(e);
for (let it = 0; (it < iterations && cost(entry) > 0) || it < 200; it++) {
  const trial = structuredClone(entry);
  const n = 1 + Math.floor(Math.random() * 2);
  const vals = [...cur];
  for (let k = 0; k < n; k++) {
    const i = Math.floor(Math.random() * spec.params.length);
    const p = spec.params[i];
    const range = p.max - p.min;
    const step = (Math.random() < 0.3 ? 0.5 : 0.08) * range * (Math.random() * 2 - 1);
    vals[i] = Math.min(p.max, Math.max(p.min, Math.round((vals[i] + step) * 2) / 2));
    apply(trial, p, vals[i]);
  }
  const c = total(trial);
  if (c <= best) {
    best = c;
    cur.splice(0, cur.length, ...vals);
    Object.assign(entry, trial);
  }
}
list[idx] = entry;
fs.writeFileSync(file, JSON.stringify(list, null, 1));
console.log(id, "cost", cost(entry).toFixed(1), "(mit Abweichung", best.toFixed(1) + ")", params.map((p, i) => `${p.path.replace("keyframes.", "k").replace(".joints.", ".")}=${cur[i]}`).join(" "));
