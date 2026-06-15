import { Card, sportLabel, sportColor } from "./Card";
import { LineChart, StackedBarChart, ChartLegend } from "@/components/charts/Charts";
import type { WeeklyVolume, FormState } from "@/domain/training/trainingLoad";

export interface FormFitnessProps {
  series: { dates: string[]; ctl: number[]; atl: number[]; tsb: number[] };
  current: { ctl: number; atl: number; tsb: number };
  form: { state: FormState; label: string };
  weeks: WeeklyVolume[];
  sports: string[];
}

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
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Fitness" sub="CTL" value={Math.round(current.ctl)} color="#0a84ff" />
        <Stat label="Ermüdung" sub="ATL" value={Math.round(current.atl)} color="#ff9f0a" />
        <Stat
          label="Form"
          sub="TSB"
          value={Math.round(current.tsb)}
          color={FORM_COLOR[form.state]}
        />
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
  value: number;
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
