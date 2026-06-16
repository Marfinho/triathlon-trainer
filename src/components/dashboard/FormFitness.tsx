import { Card, sportLabel, sportColor } from "./Card";
import { LineChart, StackedBarChart, ChartLegend } from "@/components/charts/Charts";
import type {
  WeeklyVolume,
  FormState,
  RiskLevel,
} from "@/domain/training/trainingLoad";

export interface FormFitnessProps {
  series: { dates: string[]; ctl: number[]; atl: number[]; tsb: number[] };
  current: { ctl: number; atl: number; tsb: number; acwr: number | null; rampRate: number };
  form: { state: FormState; label: string };
  acwr: { level: RiskLevel; label: string };
  load7d: number;
  load28d: number;
  weeks: WeeklyVolume[];
  sports: string[];
}

const RISK_COLOR: Record<RiskLevel, string> = {
  low: "#0a84ff",
  ok: "#34c759",
  high: "#ff3b30",
};

const FORM_COLOR: Record<FormState, string> = {
  fresh: "#34c759",
  optimal: "#30d158",
  neutral: "#0a84ff",
  tired: "#ff9f0a",
  overload: "#ff3b30",
};

function short(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
}

export function FormFitness({
  series,
  current,
  form,
  acwr,
  load7d,
  load28d,
  weeks,
  sports,
}: FormFitnessProps) {
  const labels = series.dates.map(short);
  const lineSeries = [
    { name: "Fitness (CTL)", color: "#0a84ff", values: series.ctl },
    { name: "Fatigue (ATL)", color: "#ff9f0a", values: series.atl },
    { name: "Form (TSB)", color: "#34c759", values: series.tsb },
  ];

  const weekLabels = weeks.map((w) => short(w.weekStart));
  const barSeries = sports.map((s) => ({
    name: sportLabel(s),
    color: sportColor(s),
  }));
  const barData = weeks.map((w) =>
    sports.map((s) => Math.round(((w.bySport[s] ?? 0) / 60) * 10) / 10),
  );

  return (
    <Card
      title="Form & Belastung"
      subtitle="Fitness, Ermüdung und Form (CTL / ATL / TSB) sowie Wochenvolumen"
    >
      <div className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-5">
        <Stat label="Fitness" sub="CTL" value={Math.round(current.ctl)} color="#0a84ff" />
        <Stat label="Ermüdung" sub="ATL" value={Math.round(current.atl)} color="#ff9f0a" />
        <Stat
          label="Form"
          sub="TSB"
          value={Math.round(current.tsb)}
          color={FORM_COLOR[form.state]}
        />
        <Stat
          label="Belastung"
          sub={`ACWR · ${acwr.label}`}
          value={current.acwr ?? "—"}
          color={RISK_COLOR[acwr.level]}
        />
        <Stat
          label="Aufbaurate"
          sub="CTL / Woche"
          value={current.rampRate > 0 ? `+${current.rampRate}` : current.rampRate}
          color={current.rampRate > 8 ? "#ff9f0a" : "#0a84ff"}
        />
      </div>
      <div className="mb-5 flex flex-wrap gap-3 text-xs text-neutral-500">
        <span className="rounded-lg bg-neutral-50 px-2.5 py-1">
          Load 7 Tage: <span className="font-semibold text-neutral-800">{load7d}</span>
        </span>
        <span className="rounded-lg bg-neutral-50 px-2.5 py-1">
          Load 28 Tage: <span className="font-semibold text-neutral-800">{load28d}</span>
        </span>
        {(() => {
          const prev = series.tsb[series.tsb.length - 8];
          if (prev == null) return null;
          const delta = Math.round((current.tsb - prev) * 10) / 10;
          const up = delta >= 0;
          return (
            <span className="rounded-lg bg-neutral-50 px-2.5 py-1">
              Form-Trend (7 d):{" "}
              <span className={`font-semibold ${up ? "text-emerald-600" : "text-amber-600"}`}>
                {up ? "▲" : "▼"} {up ? "+" : ""}
                {delta}
              </span>
            </span>
          );
        })()}
      </div>
      <div className="mb-2 flex items-center justify-between">
        <ChartLegend items={lineSeries.map((s) => ({ name: s.name, color: s.color }))} />
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            backgroundColor: `${FORM_COLOR[form.state]}1a`,
            color: FORM_COLOR[form.state],
          }}
        >
          {form.label}
        </span>
      </div>
      <div className="text-neutral-300">
        <LineChart labels={labels} series={lineSeries} height={200} showZeroLine />
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Wochenvolumen
          </h3>
          <ChartLegend items={barSeries} />
        </div>
        <div className="text-neutral-300">
          <StackedBarChart
            labels={weekLabels}
            series={barSeries}
            data={barData}
            height={180}
            unit="h"
          />
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  sub,
  value,
  color,
}: {
  label: string;
  sub: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">
        {label} · {sub}
      </p>
      <p className="mt-0.5 text-2xl font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
