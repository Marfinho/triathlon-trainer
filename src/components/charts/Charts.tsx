/**
 * Schlanke, abhängigkeitsfreie SVG-Charts. Bewusst zurückhaltend gestaltet
 * (ruhige Flächen, dünne Linien, dezentes Raster) – passend zum aufgeräumten
 * Look. Responsiv über `viewBox` + `width: 100%`.
 */

export interface ChartSeries {
  name: string;
  color: string;
  values: (number | null)[];
}

interface LineChartProps {
  labels: string[];
  series: ChartSeries[];
  height?: number;
  showZeroLine?: boolean;
  unit?: string;
  yTicks?: number;
}

const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 10;
const PAD_B = 22;
const VIEW_W = 720;

function niceBounds(min: number, max: number): [number, number] {
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.08;
  return [min - pad, max + pad];
}

export function LineChart({
  labels,
  series,
  height = 200,
  showZeroLine = false,
  unit = "",
  yTicks = 4,
}: LineChartProps) {
  const all = series.flatMap((s) =>
    s.values.filter((v): v is number => v != null),
  );
  if (all.length === 0) {
    return <EmptyChart height={height} />;
  }
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (showZeroLine) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  [min, max] = niceBounds(min, max);

  const n = labels.length;
  const plotW = VIEW_W - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD_T + plotH - ((v - min) / (max - min)) * plotH;

  const ticks = Array.from({ length: yTicks + 1 }, (_, i) =>
    min + ((max - min) * i) / yTicks,
  );
  const labelIdx = labelIndices(n, 5);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      width="100%"
      height={height}
      role="img"
      className="overflow-visible"
    >
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD_L}
            x2={VIEW_W - PAD_R}
            y1={y(t)}
            y2={y(t)}
            stroke="currentColor"
            strokeOpacity={t === 0 && showZeroLine ? 0.35 : 0.08}
            strokeWidth={1}
          />
          <text
            x={PAD_L - 6}
            y={y(t) + 3}
            textAnchor="end"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.45}
          >
            {Math.round(t)}
          </text>
        </g>
      ))}

      {series.map((s) => (
        <polyline
          key={s.name}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={s.values
            .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
            .filter(Boolean)
            .join(" ")}
        />
      ))}

      {labelIdx.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={height - 6}
          textAnchor="middle"
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.45}
        >
          {labels[i]}
        </text>
      ))}

      {unit ? (
        <text
          x={PAD_L - 6}
          y={PAD_T - 1}
          textAnchor="end"
          fontSize={9}
          fill="currentColor"
          fillOpacity={0.4}
        >
          {unit}
        </text>
      ) : null}
    </svg>
  );
}

interface BarChartProps {
  labels: string[];
  series: { name: string; color: string }[];
  /** data[categoryIndex][seriesIndex] */
  data: number[][];
  height?: number;
  unit?: string;
}

export function StackedBarChart({
  labels,
  series,
  data,
  height = 200,
  unit = "",
}: BarChartProps) {
  const totals = data.map((row) => row.reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...totals);
  const n = labels.length;
  const plotW = VIEW_W - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const slot = plotW / Math.max(1, n);
  const barW = Math.min(34, slot * 0.62);
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;
  const labelIdx = labelIndices(n, 8);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      width="100%"
      height={height}
      role="img"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line
            x1={PAD_L}
            x2={VIEW_W - PAD_R}
            y1={y(max * f)}
            y2={y(max * f)}
            stroke="currentColor"
            strokeOpacity={0.08}
          />
          <text
            x={PAD_L - 6}
            y={y(max * f) + 3}
            textAnchor="end"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.45}
          >
            {Math.round(max * f)}
          </text>
        </g>
      ))}

      {data.map((row, ci) => {
        const cx = PAD_L + slot * ci + slot / 2;
        let yCursor = y(0);
        return (
          <g key={ci}>
            {row.map((val, si) => {
              const h = (val / max) * plotH;
              yCursor -= h;
              return (
                <rect
                  key={si}
                  x={cx - barW / 2}
                  y={yCursor}
                  width={barW}
                  height={Math.max(0, h)}
                  rx={2}
                  fill={series[si].color}
                />
              );
            })}
          </g>
        );
      })}

      {labelIdx.map((i) => (
        <text
          key={i}
          x={PAD_L + slot * i + slot / 2}
          y={height - 6}
          textAnchor="middle"
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.45}
        >
          {labels[i]}
        </text>
      ))}

      {unit ? (
        <text
          x={PAD_L - 6}
          y={PAD_T - 1}
          textAnchor="end"
          fontSize={9}
          fill="currentColor"
          fillOpacity={0.4}
        >
          {unit}
        </text>
      ) : null}
    </svg>
  );
}

export function Sparkline({
  values,
  color = "#0a84ff",
  height = 40,
  width = 160,
}: {
  values: (number | null)[];
  color?: string;
  height?: number;
  width?: number;
}) {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return <EmptyChart height={height} />;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const n = values.length;
  const x = (i: number) => (n <= 1 ? width / 2 : (i / (n - 1)) * width);
  const y = (v: number) =>
    max === min ? height / 2 : height - ((v - min) / (max - min)) * height;
  if (nums.length === 1) {
    const i = values.findIndex((v) => v != null);
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
        <circle cx={x(i)} cy={y(nums[0])} r={2} fill={color} />
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={values
          .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
          .filter(Boolean)
          .join(" ")}
      />
    </svg>
  );
}

export function ChartLegend({
  items,
}: {
  items: { name: string; color: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((it) => (
        <span key={it.name} className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: it.color }}
          />
          {it.name}
        </span>
      ))}
    </div>
  );
}

function EmptyChart({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center text-xs text-neutral-400"
      style={{ height }}
    >
      Noch keine Daten.
    </div>
  );
}

function labelIndices(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  if (max <= 1) return [n - 1];
  const out = new Set<number>();
  for (let i = 0; i < max; i++) {
    out.add(Math.round((i * (n - 1)) / (max - 1)));
  }
  return Array.from(out).sort((a, b) => a - b);
}
