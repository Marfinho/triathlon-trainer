"use client";

/**
 * Animierter PMC-Chart (Performance Management Chart) für den Hero.
 * Drei geglättete Kurven:
 *  - CTL (Fitness, steigend)   – blau
 *  - ATL (Belastung, volatil)  – grau
 *  - TSB (Form, um 0 pendelnd)  – grün
 * Die Kurven werden per CSS stroke-dashoffset eingezeichnet.
 * Animationen werden bei prefers-reduced-motion deaktiviert.
 */

const W = 520;
const H = 320;
const PAD_L = 44;
const PAD_R = 16;
const PAD_T = 24;
const PAD_B = 36;

const innerW = W - PAD_L - PAD_R;
const innerH = H - PAD_T - PAD_B;

function x(i: number, n: number): number {
  return PAD_L + (innerW * i) / (n - 1);
}

/** Map a value in [min,max] to a y pixel (inverted). */
function y(v: number, min: number, max: number): number {
  const t = (v - min) / (max - min);
  return PAD_T + innerH * (1 - t);
}

/** Build a smooth path through points using Catmull-Rom -> cubic Bezier. */
function smoothPath(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(
      1,
    )}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// Synthetic but plausible 12-point series.
const CTL = [32, 35, 38, 40, 43, 47, 50, 53, 55, 58, 61, 64];
const ATL = [30, 44, 36, 58, 41, 66, 38, 72, 45, 61, 39, 70];
const TSB = [2, -9, 2, -18, 2, -19, 12, -19, 10, -3, 22, -6];

const N = CTL.length;

const VAL_MIN = -25;
const VAL_MAX = 80;

function toPoints(series: number[]) {
  return series.map((v, i) => ({ x: x(i, N), y: y(v, VAL_MIN, VAL_MAX) }));
}

const ctlPts = toPoints(CTL);
const atlPts = toPoints(ATL);
const tsbPts = toPoints(TSB);

const ctlPath = smoothPath(ctlPts);
const atlPath = smoothPath(atlPts);
const tsbPath = smoothPath(tsbPts);

const zeroY = y(0, VAL_MIN, VAL_MAX);

// Y-axis tick values.
const yTicks = [80, 40, 0, -20];

export default function PmcHeroChart() {
  const last = N - 1;

  return (
    <div className="relative w-full">
      <style>{`
        .pmc-line {
          stroke-dasharray: 1400;
          stroke-dashoffset: 1400;
          animation: pmc-draw 2.4s ease-out forwards;
        }
        .pmc-line.pmc-atl { animation-delay: 0.25s; }
        .pmc-line.pmc-tsb { animation-delay: 0.5s; }
        .pmc-dot { opacity: 0; animation: pmc-fade 0.6s ease-out forwards; animation-delay: 2.2s; }
        .pmc-val { opacity: 0; animation: pmc-fade 0.6s ease-out forwards; animation-delay: 2.4s; }
        @keyframes pmc-draw { to { stroke-dashoffset: 0; } }
        @keyframes pmc-fade { to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .pmc-line { animation: none; stroke-dashoffset: 0; }
          .pmc-dot, .pmc-val { animation: none; opacity: 1; }
        }
      `}</style>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Performance-Management-Chart mit CTL-, ATL- und TSB-Kurven"
        className="w-full rounded-2xl border border-[#e8e8ed] bg-white shadow-sm"
      >
        {/* Gridlines + Y axis labels */}
        {yTicks.map((t) => {
          const gy = y(t, VAL_MIN, VAL_MAX);
          return (
            <g key={t}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={gy}
                y2={gy}
                stroke="#e8e8ed"
                strokeWidth={1}
              />
              <text
                x={PAD_L - 8}
                y={gy + 4}
                textAnchor="end"
                className="font-display"
                fontSize="11"
                fill="#86868b"
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* Zero baseline (slightly emphasized for TSB) */}
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={zeroY}
          y2={zeroY}
          stroke="#d2d2d7"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* X axis labels (weeks) */}
        {["W1", "W4", "W8", "W12"].map((label, idx) => {
          const i = [0, 3, 7, 11][idx];
          return (
            <text
              key={label}
              x={x(i, N)}
              y={H - 12}
              textAnchor="middle"
              className="font-display"
              fontSize="11"
              fill="#86868b"
            >
              {label}
            </text>
          );
        })}

        {/* Curves */}
        <path
          d={ctlPath}
          fill="none"
          stroke="#0071e3"
          strokeWidth={2.5}
          strokeLinecap="round"
          className="pmc-line pmc-ctl"
        />
        <path
          d={atlPath}
          fill="none"
          stroke="#86868b"
          strokeWidth={2}
          strokeLinecap="round"
          className="pmc-line pmc-atl"
        />
        <path
          d={tsbPath}
          fill="none"
          stroke="#34c759"
          strokeWidth={2}
          strokeLinecap="round"
          className="pmc-line pmc-tsb"
        />

        {/* End dots + values */}
        <circle
          cx={ctlPts[last].x}
          cy={ctlPts[last].y}
          r={3.5}
          fill="#0071e3"
          className="pmc-dot"
        />
        <text
          x={ctlPts[last].x - 6}
          y={ctlPts[last].y - 8}
          textAnchor="end"
          className="font-display pmc-val"
          fontSize="12"
          fontWeight="500"
          fill="#0071e3"
        >
          CTL {CTL[last]}
        </text>

        <circle
          cx={tsbPts[last].x}
          cy={tsbPts[last].y}
          r={3.5}
          fill="#34c759"
          className="pmc-dot"
        />
        <text
          x={tsbPts[last].x - 6}
          y={tsbPts[last].y + 16}
          textAnchor="end"
          className="font-display pmc-val"
          fontSize="12"
          fontWeight="500"
          fill="#34c759"
        >
          TSB {TSB[last]}
        </text>

        {/* Legend */}
        <g className="font-display" fontSize="11">
          <circle cx={PAD_L + 4} cy={PAD_T + 4} r={3} fill="#0071e3" />
          <text x={PAD_L + 12} y={PAD_T + 8} fill="#86868b">
            CTL
          </text>
          <circle cx={PAD_L + 54} cy={PAD_T + 4} r={3} fill="#86868b" />
          <text x={PAD_L + 62} y={PAD_T + 8} fill="#86868b">
            ATL
          </text>
          <circle cx={PAD_L + 104} cy={PAD_T + 4} r={3} fill="#34c759" />
          <text x={PAD_L + 112} y={PAD_T + 8} fill="#86868b">
            TSB
          </text>
        </g>
      </svg>
    </div>
  );
}
