import { add, ik, lerp, lp, mul, sub, unit } from "./geometry";
import type { EngineFoot, EngineLimb, EnginePose, MixedPose, Vec } from "./types";

/* ---------- Pose-Auswertung (1:1 aus der Referenz-Engine) ---------- */

/** Nackenpunkt: explizit oder aus `lean` (Rumpflänge 34). */
export function torsoN(p: EnginePose): Vec {
  if (p.N) return p.N;
  const t = ((p.lean || 0) * Math.PI) / 180;
  return [p.P[0] + 34 * Math.sin(t), p.P[1] - 34 * Math.cos(t)];
}

/** Kopfmittelpunkt: explizit oder Nacken + Rumpfrichtung × (hd ?? 12) + 6, dazu 1,6 nach vorn. */
export function headOf(p: EnginePose, N: Vec): Vec {
  if (p.H) return p.H;
  const u = unit(sub(N, p.P)),
    fn: Vec = [-u[1], u[0]];
  return add(add(N, mul(u, (p.hd == null ? 12 : p.hd) + 6)), mul(fn, 1.6));
}

export interface ResolvedLimb {
  pts: Vec[];
  foot: EngineFoot | null;
  root: "P" | "N";
  m: string[];
}

/** Punkte einer Gliedmaße [Wurzel, Mittelgelenk, Ende]. */
export function limbPts(l: EngineLimb, roots: { P: Vec; N: Vec }): ResolvedLimb {
  const r = roots[l.root];
  let pts: Vec[];
  if (l.ik) {
    pts = [r].concat(ik(r, l.ik[0], l.ik[2], l.ik[3], l.ik[1]));
  } else {
    pts = [r].concat(l.pts as Vec[]);
  }
  return { pts, foot: l.foot || null, root: l.root, m: l.m || [] };
}

export function mixFoot(
  a: EngineFoot | null,
  b: EngineFoot | null,
  t: number,
): EngineFoot | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  const ta = a[1] == null ? a[0] : a[1],
    tb = b[1] == null ? b[0] : b[1];
  return [lerp(a[0], b[0], t), lerp(ta, tb, t), a[2] == null ? 1 : a[2], a[3] || 0];
}

export function mixLimb(
  a: EngineLimb,
  b: EngineLimb,
  t: number,
  ra: { P: Vec; N: Vec },
  rb: { P: Vec; N: Vec },
): EngineLimb {
  const foot = mixFoot(a.foot, b.foot, t);
  if (a.ik && b.ik) {
    return { root: a.root, ik: [lp(a.ik[0], b.ik[0], t), a.ik[1], a.ik[2], a.ik[3]], foot, m: a.m };
  }
  const pa = limbPts(a, ra).pts.slice(1),
    pb = limbPts(b, rb).pts.slice(1);
  return { root: a.root, pts: pa.map((p, i) => lp(p, pb[i], t)), foot, m: a.m };
}

/**
 * Mischt zwei Posen (t = 0 → S, t = 1 → T). Requisiten, Kettlebell, Band,
 * Rumpfmuskeln und Frontalansicht kommen aus S.
 */
export function mixPose(S: EnginePose, T: EnginePose, t: number): MixedPose {
  const Ns = torsoN(S),
    Nt = torsoN(T);
  const P = lp(S.P, T.P, t),
    N = lp(Ns, Nt, t);
  const ra = { P: S.P, N: Ns },
    rb = { P: T.P, N: Nt };
  const out: MixedPose = {
    P,
    N,
    H: lp(headOf(S, Ns), headOf(T, Nt), t),
    far: [],
    near: [],
    back: S.back || "",
    kb: S.kb,
    band: S.band,
    tm: S.tm || [],
    noff: S.noff,
  };
  if (S.spine || T.spine) {
    const ss = S.spine || [S.P, lp(S.P, Ns, 0.5), Ns],
      st = T.spine || [T.P, lp(T.P, Nt, 0.5), Nt];
    out.spine = ss.map((p, i) => lp(p, st[i], t));
  }
  (["far", "near"] as const).forEach((k) => {
    (S[k] || []).forEach((l, i) => {
      out[k].push(mixLimb(l, T[k][i], t, ra, rb));
    });
  });
  return out;
}

/** Eine einzelne Pose normalisieren (= mit sich selbst mischen). */
export function normPose(p: EnginePose): MixedPose {
  return mixPose(p, p, 0);
}
