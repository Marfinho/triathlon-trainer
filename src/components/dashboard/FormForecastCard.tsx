import { Card } from "./Card";
import { LineChart, ChartLegend } from "@/components/charts/Charts";

export interface ForecastPointView {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
}

const VERDICT_STYLE: Record<string, { label: string; cls: string }> = {
  optimal: { label: "Optimaler Taper", cls: "bg-emerald-50 text-emerald-700" },
  zu_muede: { label: "Noch zu müde", cls: "bg-amber-50 text-amber-700" },
  zu_frisch: { label: "Zu stark getapert", cls: "bg-blue-50 text-blue-700" },
  kein_renntag: { label: "Kein Renntag", cls: "bg-neutral-100 text-neutral-500" },
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Form-Forecast & Taper-Planer: zeigt die nach vorne projizierte
 * Fitness/Ermüdung/Form-Kurve bis zum Renntag und bewertet, ob der geplante
 * Taper die optimale Renntags-Frische trifft.
 */
export function FormForecastCard({
  series,
  raceDay,
  verdict,
  recommendation,
  raceName,
}: {
  series: ForecastPointView[];
  raceDay: ForecastPointView | null;
  verdict: string;
  recommendation: string;
  raceName: string | null;
}) {
  const style = VERDICT_STYLE[verdict] ?? VERDICT_STYLE.kein_renntag;
  const labels = series.map((p) => p.date);

  return (
    <Card
      title="Form-Forecast & Taper-Planer"
      subtitle="Vorausberechnete Form bis zum Renntag – basierend auf deinen geplanten Workouts"
      actions={
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style.cls}`}>
          {style.label}
        </span>
      }
    >
      {series.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Noch keine geplanten Workouts für eine Vorhersage. Importiere einen Plan, um
          deine Renntags-Form zu projizieren.
        </p>
      ) : (
        <>
          {raceDay ? (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric label="Fitness am Renntag" value={raceDay.ctl.toFixed(0)} hint="CTL" />
              <Metric label="Ermüdung" value={raceDay.atl.toFixed(0)} hint="ATL" />
              <Metric
                label="Form"
                value={`${raceDay.tsb > 0 ? "+" : ""}${raceDay.tsb.toFixed(0)}`}
                hint="TSB"
                highlight
              />
            </div>
          ) : null}

          <LineChart
            labels={labels}
            showZeroLine
            series={[
              { name: "Fitness (CTL)", color: "#0a84ff", values: series.map((p) => p.ctl) },
              { name: "Ermüdung (ATL)", color: "#ff9f0a", values: series.map((p) => p.atl) },
              { name: "Form (TSB)", color: "#34c759", values: series.map((p) => p.tsb) },
            ]}
          />
          <ChartLegend
            items={[
              { name: "Fitness (CTL)", color: "#0a84ff" },
              { name: "Ermüdung (ATL)", color: "#ff9f0a" },
              { name: "Form (TSB)", color: "#34c759" },
            ]}
          />

          <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${style.cls}`}>
            <p className="font-semibold">
              {raceName ? `${raceName} · ${raceDay ? fmtDate(raceDay.date) : ""}` : "Empfehlung"}
            </p>
            <p className="mt-1">{recommendation}</p>
          </div>
        </>
      )}
    </Card>
  );
}

function Metric({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight ? "border-emerald-200 bg-emerald-50/50" : "border-neutral-200 bg-neutral-50"
      }`}
    >
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-neutral-900">{value}</p>
      <p className="text-[11px] text-neutral-400">{hint}</p>
    </div>
  );
}
