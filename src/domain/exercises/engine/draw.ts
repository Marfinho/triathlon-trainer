import { footGeo } from "./foot";
import { add, f1, len, mul, polyAt, quad, rT, sub, unit } from "./geometry";
import { legMus, torsoMus, type MuscleShape } from "./muscles";
import { limbPts } from "./pose";
import { AR, capChain, capShape, circ, LR } from "./shapes";
import type { EngineLimb, EngineMuscle, MixedPose, Vec } from "./types";

/* ---------- Körper zeichnen (1:1 aus der Referenz-Engine) ---------- */

export type MuscleMeta = Record<string, EngineMuscle>;

interface LimbShapes {
  s0: string;
  s1: string;
  end: string;
  hasEnd: boolean;
  isLeg: boolean;
  sole: string;
}

function limbShapes(L: { pts: Vec[]; foot: EngineLimb["foot"]; root: "P" | "N" }): LimbShapes {
  const isLeg = L.root === "P",
    R = isLeg ? LR : AR,
    e = L.pts[2];
  const s0 = capShape(L.pts[0], L.pts[1], R[0][0], R[0][1]);
  const s1 = capShape(L.pts[1], L.pts[2], R[1][0], R[1][1]);
  let end = "",
    hasEnd = false,
    sole = "";
  if (isLeg) {
    if (L.foot) {
      const fg = footGeo(e, L.foot);
      end = fg.svg;
      sole = fg.sole;
      hasEnd = true;
    }
  } else {
    end = circ(e, 3.2);
    hasEnd = true;
  }
  return { s0, s1, end, hasEnd, isLeg, sole };
}

/**
 * Zeichnet eine aufgelöste Pose. Reihenfolge: ferne Gliedmaßen → Hals → Rumpf
 * (Kontur, Füllung, Hüfte, Rumpfmuskeln) → nahe Gliedmaßen → Kopf →
 * Kettlebell → Band. Konturtechnik: erst dicke Kontur (`bo`), dann Füllung.
 * `ghost` = blasse Figur als eine Gruppe (`gh`) ohne Muskeln und Geräte.
 */
export function drawBody(
  pose: MixedPose,
  meta: MuscleMeta,
  ghost: boolean,
): { svg: string; marks: Record<string, Vec> } {
  const P = pose.P,
    N = pose.N,
    tp = pose.spine ? quad(pose.spine, 10) : [P, N];
  const u = unit(sub(N, P)),
    fnT: Vec = [-u[1], u[0]],
    noff = !!pose.noff;
  const marks: Record<string, Vec> = {};
  let out = "";
  const roots = { P, N: sub(N, mul(u, 3)) };

  function ovl(key: string, r: MuscleShape | null): string {
    const m = meta[key];
    if (!r || !m) return "";
    marks[key] = r.c;
    return '<g class="mus ' + m.kind + " l" + m.lv + '">' + r.svg + "</g>";
  }
  function drawLimb(l: EngineLimb, far: boolean): string {
    const L = limbPts(l, roots),
      sh = limbShapes(L);
    let o = "";
    if (ghost) {
      return '<g class="gh-i">' + sh.s0 + sh.s1 + sh.end + "</g>";
    }
    o += '<g class="bo">' + sh.s0 + sh.s1 + sh.end + "</g>";
    if (sh.isLeg) {
      o += '<g class="' + (far ? "c-legF" : "c-leg") + '">' + sh.s1 + sh.s0 + "</g>";
      if (sh.hasEnd) o += '<g class="c-shoe">' + sh.end + '</g><path class="sole" d="' + sh.sole + '"/>';
    } else {
      o += '<g class="' + (far ? "c-skinF" : "c-skin") + '">' + sh.s1 + sh.end + "</g>";
      o += '<g class="' + (far ? "c-topF" : "c-top") + '">' + sh.s0 + "</g>";
    }
    if (sh.isLeg) {
      L.m.forEach((k) => {
        o += ovl(k, legMus(k, L.pts, noff, fnT, u));
      });
    }
    return o;
  }

  const parts: string[] = [];
  pose.far.forEach((l) => {
    parts.push(drawLimb(l, true));
  });

  // Hals (liegt hinter dem Rumpf, der Ansatz wird überdeckt)
  const Hn = pose.H,
    nu0 = unit(sub(Hn, N)),
    neckS = capShape(sub(N, mul(nu0, 3)), sub(Hn, mul(nu0, 6)), 3.4, 3.2);
  if (ghost) {
    parts.push('<g class="gh-i">' + neckS + "</g>");
  } else {
    parts.push('<g class="bo">' + neckS + '</g><g class="c-skin">' + neckS + "</g>");
  }

  // Rumpf
  const ts: [Vec, number][] = [],
    K = 8;
  for (let i = 0; i <= K; i++) {
    const q = polyAt(tp, i / K);
    ts.push([q.p, rT(i / K)]);
  }
  const torso = capChain(ts);
  const hip = circ(P, 8.4);
  if (ghost) {
    parts.push('<g class="gh-i">' + torso + hip + "</g>");
  } else {
    parts.push('<g class="bo">' + torso + hip + "</g>");
    parts.push('<g class="c-top">' + torso + "</g>");
    parts.push('<g class="c-leg">' + hip + "</g>");
    (pose.tm || []).forEach((k) => {
      parts.push(ovl(k, torsoMus(k, tp, noff)));
    });
  }
  pose.near.forEach((l) => {
    parts.push(drawLimb(l, false));
  });

  // Kopf
  const H = pose.H,
    tEnd = polyAt(tp, 1).t,
    fnE: Vec = [-tEnd[1], tEnd[0]];
  const hair = circ(H, 7.8),
    face = circ(add(H, mul(fnE, 1.7)), 6.6);
  if (ghost) {
    parts.push('<g class="gh-i">' + hair + "</g>");
  } else {
    parts.push('<g class="bo">' + hair + "</g>");
    parts.push('<g class="c-hair">' + hair + '</g><g class="c-skin">' + face + "</g>");
  }

  // Kettlebell
  if (!ghost && pose.kb) {
    const arm = pose.near[pose.kb.arm],
      A = limbPts(arm, roots).pts[2];
    const c = add(A, pose.kb.off);
    parts.push(
      '<path class="kbh" d="M' +
        f1(c[0] - 4) +
        "," +
        f1(c[1] - 5) +
        " Q" +
        f1(c[0]) +
        "," +
        f1(c[1] - 14) +
        " " +
        f1(c[0] + 4) +
        "," +
        f1(c[1] - 5) +
        '"/><circle class="kb" cx="' +
        f1(c[0]) +
        '" cy="' +
        f1(c[1]) +
        '" r="6.5"/>',
    );
  }
  // Band
  if (!ghost && pose.band) {
    const bl = limbPts(pose.near[pose.band.limb], roots).pts[1],
      src = pose.band.from;
    const w = unit(sub(bl, src)),
      nn: Vec = [-w[1], w[0]];
    const c1 = add(bl, mul(nn, 7)),
      c2 = add(bl, mul(nn, -7)),
      cc = add(bl, mul(w, 10));
    parts.push(
      '<path class="band" d="M' +
        src[0] +
        "," +
        src[1] +
        " L" +
        f1(bl[0]) +
        "," +
        f1(bl[1]) +
        '"/>' +
        '<path class="band" d="M' +
        f1(c1[0]) +
        "," +
        f1(c1[1]) +
        " Q" +
        f1(cc[0]) +
        "," +
        f1(cc[1]) +
        " " +
        f1(c2[0]) +
        "," +
        f1(c2[1]) +
        '"/>',
    );
  }
  out = parts.join("");
  if (ghost) out = '<g class="gh">' + out + "</g>";
  return { svg: out, marks };
}

/**
 * Nummerierte Muskelmarker in der Reihenfolge von `muscles[]`. Überlappende
 * Marker werden schrittweise nach rechts unten verschoben.
 */
export function drawMarkers(marks: Record<string, Vec>, order: EngineMuscle[]): string {
  const placed: Vec[] = [];
  let s = "";
  order.forEach((m, idx) => {
    const c = marks[m.key];
    if (!c) return;
    let p: Vec = [c[0], c[1]],
      tries = 0;
    while (tries < 6 && placed.some((q) => len(sub(p, q)) < 11.5)) {
      p = [p[0] + 3, p[1] + 11.5];
      tries++;
    }
    placed.push(p);
    s +=
      '<circle class="mk-c ' +
      m.kind +
      '" cx="' +
      f1(p[0]) +
      '" cy="' +
      f1(p[1]) +
      '" r="5.2"/>' +
      '<text class="mk-t ' +
      m.kind +
      '" x="' +
      f1(p[0]) +
      '" y="' +
      f1(p[1] + 0.3) +
      '">' +
      (idx + 1) +
      "</text>";
  });
  return s;
}
