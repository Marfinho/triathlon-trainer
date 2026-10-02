import {
  buildScene,
  heroKeyframe,
  poseAt,
  type Exercise3dDefinition,
  type Pose3d,
} from "@/domain/exercises/body3d";
import { createBody3dRenderer, type Body3dRenderer } from "./body3dRenderer";
import { loadBodyModel } from "./loadBodyModel";

/**
 * Standbilder (Muskelbild, Ablauf, Fehlerbild, Vorschau) aus dem echten
 * 3D-Körper. Ein unsichtbarer Renderer je Übung, Aufträge laufen
 * nacheinander – so bleibt die Zahl der WebGL-Kontexte klein.
 */

export type StillSpec =
  | { kind: "hero" }
  | { kind: "thumb" }
  | { kind: "frame"; index: number }
  | { kind: "fault" };

export interface StillMarker {
  n: number;
  x: number;
  y: number;
  stretch: boolean;
}

export interface StillResult {
  url: string;
  markers: StillMarker[];
}

const W = 600,
  H = 480;
const MAX_RENDERERS = 3;
const renderers = new Map<string, Body3dRenderer>();
let queue: Promise<unknown> = Promise.resolve();

function poseFor(def: Exercise3dDefinition, spec: StillSpec): { pose: Pose3d; ghost: Pose3d | null } | null {
  if (spec.kind === "hero" || spec.kind === "thumb") return { pose: def.keyframes[heroKeyframe(def)], ghost: null };
  if (spec.kind === "fault") return def.fault ? { pose: def.fault.pose, ghost: null } : null;
  const fr = def.frames[spec.index];
  if (!fr) return null;
  // wie die SVG-Fassung: blasse Figur = vorheriges Schlüsselbild
  const ghostIdx = fr.at === 0 ? null : Number.isInteger(fr.at) ? fr.at - 1 : Math.floor(fr.at);
  return { pose: poseAt(def, fr.at), ghost: ghostIdx === null ? null : def.keyframes[ghostIdx] };
}

async function rendererFor(def: Exercise3dDefinition, colorSource: Element): Promise<Body3dRenderer | null> {
  const key = JSON.stringify(def);
  const have = renderers.get(key);
  if (have) return have;
  const model = await loadBodyModel();
  if (!model) return null;
  if (renderers.size >= MAX_RENDERERS) {
    const [oldKey, old] = renderers.entries().next().value as [string, Body3dRenderer];
    old.dispose();
    renderers.delete(oldKey);
  }
  const canvas = document.createElement("canvas");
  const r = createBody3dRenderer(canvas, def, colorSource, model);
  r.resize(W, H);
  renderers.set(key, r);
  return r;
}

export function renderStill(def: Exercise3dDefinition, spec: StillSpec, colorSource: Element): Promise<StillResult | null> {
  const job = queue.then(async () => {
    const p = poseFor(def, spec);
    if (!p) return null;
    const r = await rendererFor(def, colorSource);
    if (!r) return null;
    r.setGhost(p.ghost);
    r.setPose(p.pose, "body");
    const markers: StillMarker[] = [];
    if (spec.kind === "hero") {
      const prims = buildScene(def, p.pose).primitives;
      def.muscles.forEach((m, i) => {
        const base = m.id.replace(/_[lr]$/, "");
        const side = /_l$/.test(m.id) ? "l" : /_r$/.test(m.id) ? "r" : null;
        // sichtbarere Seite: die näher an der Kamera liegende Instanz
        const cands = prims
          .filter((q) => q.kind === "muscle" && q.muscle === base && (!side || q.side === side))
          .map((q) => (q.kind === "muscle" ? q.center : [0, 0, 0]) as [number, number, number]);
        if (!cands.length) return;
        const pts = cands.map((c) => r.project(c)).sort((a, b) => a[2] - b[2]);
        const [x, y] = pts[0];
        markers.push({ n: i + 1, x, y, stretch: m.role === "stretch" });
      });
      // überlappende Nummern leicht versetzen
      for (let i = 0; i < markers.length; i++)
        for (let j = 0; j < i; j++)
          if (Math.hypot(markers[i].x - markers[j].x, (markers[i].y - markers[j].y) * 0.8) < 0.05) markers[i].y += 0.055;
    }
    const url = r.snapshot();
    r.setGhost(null);
    return { url, markers };
  });
  queue = job.catch(() => null);
  return job.catch(() => null);
}
