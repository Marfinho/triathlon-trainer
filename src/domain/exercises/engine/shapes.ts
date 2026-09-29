import { f1 } from "./geometry";
import type { Vec } from "./types";

/* ---------- Formen (1:1 aus der Referenz-Engine) ---------- */

/** Kapsel zwischen a und b mit Radien ra/rb: Trapez plus zwei Kreise. */
export function capShape(a: Vec, b: Vec, ra: number, rb: number): string {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    d = Math.hypot(dx, dy) || 1e-3,
    nx = -dy / d,
    ny = dx / d;
  const pts = [
    f1(a[0] + nx * ra) + "," + f1(a[1] + ny * ra),
    f1(b[0] + nx * rb) + "," + f1(b[1] + ny * rb),
    f1(b[0] - nx * rb) + "," + f1(b[1] - ny * rb),
    f1(a[0] - nx * ra) + "," + f1(a[1] - ny * ra),
  ].join(" ");
  return (
    '<polygon points="' +
    pts +
    '"/><circle cx="' +
    f1(a[0]) +
    '" cy="' +
    f1(a[1]) +
    '" r="' +
    ra +
    '"/>' +
    '<circle cx="' +
    f1(b[0]) +
    '" cy="' +
    f1(b[1]) +
    '" r="' +
    rb +
    '"/>'
  );
}

export function circ(c: Vec, r: number): string {
  return '<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + r + '"/>';
}

/** Kette von Kapseln durch [Punkt, Radius]-Paare. */
export function capChain(list: [Vec, number][]): string {
  let s = "";
  for (let i = 1; i < list.length; i++)
    s += capShape(list[i - 1][0], list[i][0], list[i - 1][1], list[i][1]);
  return s;
}

/** Radien Bein [Oberschenkel, Unterschenkel] × [Anfang, Ende]. */
export const LR: [number, number][] = [
  [6.2, 4.8],
  [4.6, 3.1],
];
/** Radien Arm [Oberarm, Unterarm] × [Anfang, Ende]. */
export const AR: [number, number][] = [
  [4.3, 3.5],
  [3.4, 2.6],
];
