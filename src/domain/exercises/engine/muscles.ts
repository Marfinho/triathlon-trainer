import { add, lerp, lp, mul, polyAt, rT, sub, unit } from "./geometry";
import { capChain, circ, LR } from "./shapes";
import type { Vec } from "./types";

/* ---------- Muskeln (1:1 aus der Referenz-Engine) ---------- */

export interface MuscleShape {
  svg: string;
  /** Mittelpunkt für die nummerierte Markierung */
  c: Vec;
}

function rAt(R: [number, number][], seg: number, f: number): number {
  return lerp(R[seg][0], R[seg][1], f);
}

function segOvl(
  pts: Vec[],
  seg: number,
  f1_: number,
  f2_: number,
  side: number,
  wf: number,
  off: number,
): MuscleShape {
  const a = pts[seg],
    b = pts[seg + 1],
    d = unit(sub(b, a)),
    fn: Vec = [d[1], -d[0]];
  function mk(f: number): [Vec, number] {
    const r = rAt(LR, seg, Math.min(f, 1));
    return [add(lp(a, b, f), mul(fn, side * off * r)), r * wf];
  }
  const list = [mk(f1_), mk((f1_ + f2_) / 2), mk(f2_)];
  return { svg: capChain(list), c: list[1][0] };
}

export function legMus(
  key: string,
  pts: Vec[],
  noff: boolean,
  fnT: Vec,
  tu: Vec,
): MuscleShape | null {
  const sd = noff ? 0 : 1,
    d = unit(sub(pts[1], pts[0]));
  switch (key) {
    case "quad":
      return segOvl(pts, 0, 0.14, 0.88, sd, 0.78, 0.22);
    case "ham":
      return segOvl(pts, 0, 0.14, 0.88, -sd, 0.78, 0.22);
    case "vmo":
      return segOvl(pts, 0, 0.55, 0.96, sd, 0.7, 0.26);
    case "add":
      return segOvl(pts, 0, 0.15, 0.78, 0, 0.55, 0);
    case "calf":
      return segOvl(pts, 1, 0.06, 0.58, -sd, 0.86, 0.14);
    case "sol":
      return segOvl(pts, 1, 0.4, 0.86, -sd, 0.78, 0.2);
    case "ach":
      return segOvl(pts, 1, 0.8, 1.0, -sd, 0.5, 0.3);
    case "tib":
      return segOvl(pts, 1, 0.1, 0.82, sd, 0.66, 0.3);
    case "pat": {
      const s0 = unit(sub(pts[1], pts[0]));
      const c = add(pts[1], mul([s0[1], -s0[0]], sd * 4.2));
      return { svg: circ(c, 2.8), c };
    }
    case "glute": {
      const g = noff ? add(pts[0], mul(d, 2)) : add(add(pts[0], mul(fnT, -5)), mul(d, 2.5));
      return { svg: circ(g, 6.2), c: g };
    }
    case "hipfl": {
      const h = noff ? pts[0] : add(add(pts[0], mul(fnT, 5)), mul(d, 1.5));
      return { svg: circ(h, 4.8), c: h };
    }
    case "glmed": {
      const m = noff ? add(pts[0], mul(tu, 2)) : add(add(pts[0], mul(fnT, -3.5)), mul(tu, 3.5));
      return { svg: circ(m, 5.2), c: m };
    }
  }
  return null;
}

export function torsoMus(key: string, tp: Vec[], noff: boolean): MuscleShape | null {
  const sd = noff ? 0 : 1;
  function chain(a: number, b: number, side: number, wf: number, off: number): MuscleShape {
    const list = [a, (a + b) / 2, b].map((f): [Vec, number] => {
      const q = polyAt(tp, f),
        r = rT(f),
        fn: Vec = [-q.t[1], q.t[0]];
      return [add(q.p, mul(fn, side * off * r)), r * wf];
    });
    return { svg: capChain(list), c: list[1][0] };
  }
  switch (key) {
    case "core":
      return chain(0.12, 0.72, sd, 0.62, 0.36);
    case "back":
      return chain(0.35, 0.95, -sd, 0.6, 0.36);
    case "obl":
      return chain(0.1, 0.68, 0, 0.6, 0);
    case "chest":
      return chain(0.6, 0.95, sd, 0.6, 0.36);
  }
  return null;
}
