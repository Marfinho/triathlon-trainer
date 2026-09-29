import type { Vec } from "./types";

/* ---------- Vektoren (1:1 aus der Referenz-Engine) ---------- */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function lp(a: Vec, b: Vec, t: number): Vec {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}
export function add(a: Vec, b: Vec): Vec {
  return [a[0] + b[0], a[1] + b[1]];
}
export function sub(a: Vec, b: Vec): Vec {
  return [a[0] - b[0], a[1] - b[1]];
}
export function mul(a: Vec, k: number): Vec {
  return [a[0] * k, a[1] * k];
}
export function len(a: Vec): number {
  return Math.hypot(a[0], a[1]);
}
export function unit(a: Vec): Vec {
  const l = len(a) || 1e-3;
  return [a[0] / l, a[1] / l];
}
/** Zahlformat der Engine: eine Nachkommastelle. */
export function f1(x: number): string {
  return x.toFixed(1);
}

/**
 * Zwei-Knochen-IK: liefert [Mittelgelenk, Endpunkt]. Ist das Ziel weiter weg
 * als l1 + l2, wird es auf die maximale Reichweite gekürzt; `s` wählt die
 * Beugerichtung (1/−1).
 */
export function ik(a: Vec, b: Vec, l1: number, l2: number, s: number): [Vec, Vec] {
  let dx = b[0] - a[0],
    dy = b[1] - a[1],
    d = Math.hypot(dx, dy);
  const mx = l1 + l2 - 0.05;
  let bx = b[0],
    by = b[1];
  if (d > mx) {
    const k = mx / d;
    bx = a[0] + dx * k;
    by = a[1] + dy * k;
    dx = bx - a[0];
    dy = by - a[1];
    d = mx;
  }
  d = Math.max(d, 0.5);
  const aa = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(l1 * l1 - aa * aa, 0));
  const px = dy / d,
    py = -dx / d;
  return [
    [a[0] + (dx * aa) / d + s * px * h, a[1] + (dy * aa) / d + s * py * h],
    [bx, by],
  ];
}

/** Quadratische Bézierkurve, in n Schritten abgetastet. */
export function quad(sp: Vec[], n: number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = 1 - t;
    out.push([
      u * u * sp[0][0] + 2 * u * t * sp[1][0] + t * t * sp[2][0],
      u * u * sp[0][1] + 2 * u * t * sp[1][1] + t * t * sp[2][1],
    ]);
  }
  return out;
}

/** Punkt und Tangente bei Anteil f (0…1) der Bogenlänge eines Polygonzugs. */
export function polyAt(tp: Vec[], f: number): { p: Vec; t: Vec } {
  const L = [0];
  let i: number;
  for (i = 1; i < tp.length; i++) L.push(L[i - 1] + len(sub(tp[i], tp[i - 1])));
  const tot = L[L.length - 1] || 1e-3,
    x = Math.min(Math.max(f, 0), 1) * tot;
  for (i = 1; i < tp.length; i++) {
    if (x <= L[i] || i === tp.length - 1) {
      const seg = L[i] - L[i - 1] || 1e-3,
        k = (x - L[i - 1]) / seg;
      return { p: lp(tp[i - 1], tp[i], k), t: unit(sub(tp[i], tp[i - 1])) };
    }
  }
  // Nicht erreichbar, solange tp mindestens zwei Punkte hat.
  throw new Error("polyAt: Polygonzug braucht mindestens zwei Punkte");
}

/** Rumpfradius entlang der Wirbelsäule (Hüfte → Schulter). */
export function rT(f: number): number {
  return f < 0.7 ? lerp(7.6, 9.0, f / 0.7) : lerp(9.0, 6.6, (f - 0.7) / 0.3);
}
