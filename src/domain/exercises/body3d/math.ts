/**
 * Kleine, deterministische 3D-Mathematik (kein DOM, keine Abhängigkeit).
 * Koordinaten in cm: x = vorn (Blickrichtung im Stand), y = oben, z = rechts.
 * Matrizen: 3×3, zeilenweise als Array mit 9 Zahlen.
 */
export type V3 = [number, number, number];
export type M3 = [number, number, number, number, number, number, number, number, number];

export const DEG = Math.PI / 180;

export const v = (x: number, y: number, z: number): V3 => [x, y, z];
export const vadd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vscale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const vdot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vcross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const vlen = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const vnorm = (a: V3): V3 => {
  const l = vlen(a) || 1e-9;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const vlerp = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const IDENTITY: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mmul(a: M3, b: M3): M3 {
  const r = new Array(9).fill(0) as M3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}

export function mapply(m: M3, p: V3): V3 {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
    m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
    m[6] * p[0] + m[7] * p[1] + m[8] * p[2],
  ];
}

/** Rotation um die x-Achse (Winkel in Grad). */
export function rx(deg: number): M3 {
  const c = Math.cos(deg * DEG),
    s = Math.sin(deg * DEG);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
/** Rotation um die y-Achse (Winkel in Grad). */
export function ry(deg: number): M3 {
  const c = Math.cos(deg * DEG),
    s = Math.sin(deg * DEG);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
/** Rotation um die z-Achse (Winkel in Grad). */
export function rz(deg: number): M3 {
  const c = Math.cos(deg * DEG),
    s = Math.sin(deg * DEG);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** Spalte i der Matrix (= gedrehte lokale Achse). */
export function mcol(m: M3, i: 0 | 1 | 2): V3 {
  return [m[i], m[3 + i], m[6 + i]];
}

/** Drehung, die Richtung a auf Richtung b abbildet (Rodrigues, minimal). */
export function rotateBetween(a: V3, b: V3): M3 {
  const u = vnorm(a),
    w = vnorm(b);
  const c = vdot(u, w);
  if (c > 1 - 1e-9) return IDENTITY;
  let axis = vcross(u, w);
  if (vlen(axis) < 1e-9) {
    // entgegengesetzt: beliebige Senkrechte
    axis = Math.abs(u[0]) < 0.9 ? vcross(u, [1, 0, 0]) : vcross(u, [0, 1, 0]);
  }
  const k = vnorm(axis);
  const s = Math.sqrt(Math.max(0, 1 - c * c));
  const t = 1 - c;
  const [x, y, z] = k;
  return [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  ];
}
