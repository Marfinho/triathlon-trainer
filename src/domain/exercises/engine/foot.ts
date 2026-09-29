import { f1 } from "./geometry";
import { capShape, circ } from "./shapes";
import type { EngineFoot, Vec } from "./types";

/**
 * Schuh am Fußgelenk `a`: Ferse, Knöchel, Mittelfuß–Ballen, Zehen (eigener
 * Winkel möglich) plus Sohlenlinie 3,2 unter dem Gelenk. 1:1 aus der Referenz.
 */
export function footGeo(a: Vec, ft: EngineFoot): { svg: string; sole: string } {
  const phi = (ft[0] * Math.PI) / 180,
    pt = ((ft[1] == null ? ft[0] : ft[1]) * Math.PI) / 180;
  const dr = ft[2] || 1,
    fl = ft[3] ? -1 : 1,
    s = 3.2;
  function dirs(ph: number): { f: Vec; g: Vec } {
    return { f: [dr * Math.cos(ph), Math.sin(ph)], g: [-dr * Math.sin(ph) * fl, Math.cos(ph) * fl] };
  }
  const A = dirs(phi),
    B = dirs(pt);
  function P(f: number, g: number): Vec {
    return [a[0] + A.f[0] * f + A.g[0] * g, a[1] + A.f[1] * f + A.g[1] * g];
  }
  const heel = P(-2.4, s - 3.6),
    collar = P(0, 0),
    mid = P(2.4, s - 3.2),
    ball = P(8.8, s - 2.9),
    Bs = P(8.8, s);
  const tip: Vec = [Bs[0] + B.f[0] * 1.9 - B.g[0] * 2.5, Bs[1] + B.f[1] * 1.9 - B.g[1] * 2.5];
  const tipSole: Vec = [Bs[0] + B.f[0] * 4.4, Bs[1] + B.f[1] * 4.4],
    hs = P(-2.4, s);
  return {
    svg:
      circ(heel, 3.6) +
      circ(collar, 3.2) +
      capShape(mid, ball, 3.2, 2.9) +
      capShape(ball, tip, 2.9, 2.5),
    sole:
      "M" +
      f1(hs[0]) +
      "," +
      f1(hs[1]) +
      " L" +
      f1(Bs[0]) +
      "," +
      f1(Bs[1]) +
      " L" +
      f1(tipSole[0]) +
      "," +
      f1(tipSole[1]),
  };
}
