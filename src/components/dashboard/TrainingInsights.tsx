import { Card, sportLabel, sportColor } from "./Card";
import { Sparkline } from "@/components/charts/Charts";
import type { IntensityDistribution, SportShare, MonthlyVolume, BestPace } from "@/domain/training/analytics";
import type { TrainingRecommendation } from "@/domain/training/loadAdvisor";
import type { RiskLevel } from "@/domain/training/trainingLoad";

function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

const REC_STYLE: Record<string, string> = {
  go_hard: "bg-emerald-50 text-emerald-700",
  steady: "bg-blue-50 text-blue-700",
  easy: "bg-amber-50 text-amber-700",
  recover: "bg-rose-50 text-rose-700",
};

const RISK_STYLE: Record<RiskLevel, string> = {
  low: "bg-emerald-50 text-emerald-700",
  ok: "bg-neutral-100 text-neutral-500",
  high: "bg-rose-50 text-rose-700",
};

export interface TrainingInsightsProps {
  intensity: IntensityDistribution;
  recommendation: TrainingRecommendation;
  sportShares: SportShare[];
  sportWarning: string | null;
  monthly: MonthlyVolume[];
  bestPaces: BestPace[];
  efficiencyValues: number[];
  vdot: { vdot: number; category: string } | null;
  consistency: { score: number; label: string };
  rampRatio: number | null;
  rampRisk: RiskLevel;
  caloriesLast7d: number | null;
}

export function TrainingInsights(props: TrainingInsightsProps) {
  const {
    intensity,
    recommendation,
    sportShares,
    sportWarning,
    monthly,
    bestPaces,
    efficiencyValues,
    vdot,
    consistency,
    rampRatio,
    rampRisk,
    caloriesLast7d,
  } = props;

  return (
    <Card title="Trainings-Analyse" subtitle="Auswertung deiner Ist-Daten">
      {/* Empfehlung */}
      <div className={`mb-4 rounded-xl px-4 py-3 ${REC_STYLE[recommendation.level] ?? "bg-neutral-100"}`}>
        <p className="text-sm font-semibold">{recommendation.headline}</p>
        <p className="mt-0.5 text-xs">{recommendation.detail}</p>
      </div>

      {/* Kennzahlen-Grid */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label="VO2max (VDOT)"
          value={vdot ? vdot.vdot.toFixed(0) : "—"}
          hint={vdot ? vdot.category : "kein Lauf-Ref."}
        />
        <Tile label="Konsistenz" value={`${consistency.score}%`} hint={consistency.label} />
        <Tile
          label="Wochen-Ramp"
          value={rampRatio != null ? `${rampRatio.toFixed(2)}×` : "—"}
          hint={rampRisk === "high" ? "riskant" : "im Rahmen"}
          badgeClass={RISK_STYLE[rampRisk]}
        />
        <Tile
          label="kcal (7 Tage)"
          value={caloriesLast7d != null ? caloriesLast7d.toLocaleString("de-DE") : "—"}
          hint="geschätzt"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Intensitätsverteilung */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Intensitätsverteilung
            {intensity.model !== "unklar" ? (
              <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium normal-case text-neutral-600">
                {intensity.model}
              </span>
            ) : null}
          </h3>
          {intensity.sampleCount === 0 ? (
            <p className="text-sm text-neutral-400">Noch keine RPE-Daten.</p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                <span style={{ width: `${intensity.easyPct}%` }} className="bg-emerald-400" />
                <span style={{ width: `${intensity.moderatePct}%` }} className="bg-amber-400" />
                <span style={{ width: `${intensity.hardPct}%` }} className="bg-rose-400" />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-neutral-500">
                <span>easy {intensity.easyPct}%</span>
                <span>moderat {intensity.moderatePct}%</span>
                <span>hart {intensity.hardPct}%</span>
              </div>
            </>
          )}
        </div>

        {/* Sportbalance */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Sportbalance
          </h3>
          {sportShares.length === 0 ? (
            <p className="text-sm text-neutral-400">Keine Daten.</p>
          ) : (
            <div className="space-y-1.5">
              {sportShares.map((s) => (
                <div key={s.sport} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-neutral-600">{sportLabel(s.sport)}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${s.pct}%`, backgroundColor: sportColor(s.sport) }}
                    />
                  </div>
                  <span className="w-9 text-right text-xs text-neutral-500">{s.pct}%</span>
                </div>
              ))}
              {sportWarning ? (
                <p className="mt-1 text-[11px] text-amber-600">{sportWarning}</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Best paces */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Bestleistungen (Pace)
          </h3>
          {bestPaces.length === 0 ? (
            <p className="text-sm text-neutral-400">Keine Daten.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {bestPaces.map((b) => (
                <li key={b.sport} className="flex justify-between">
                  <span className="text-neutral-500">{sportLabel(b.sport)}</span>
                  <span className="font-medium text-neutral-800">
                    {fmtPace(b.secPerKm)}{" "}
                    <span className="text-[11px] text-neutral-400">({b.distanceKm} km)</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Effizienztrend */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Aerobe Effizienz (Verlauf)
          </h3>
          {efficiencyValues.length < 2 ? (
            <p className="text-sm text-neutral-400">Zu wenige HF-Daten.</p>
          ) : (
            <Sparkline values={efficiencyValues} color="#30b0c7" height={40} />
          )}
        </div>
      </div>

      {/* Monatsvolumen */}
      {monthly.length > 0 ? (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Monatsvolumen (Stunden)
          </h3>
          <div className="flex items-end gap-1.5">
            {monthly.slice(-12).map((m) => {
              const max = Math.max(...monthly.map((x) => x.hours), 1);
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-blue-400"
                    style={{ height: `${Math.max(2, (m.hours / max) * 60)}px` }}
                    title={`${m.month}: ${m.hours} h`}
                  />
                  <span className="text-[9px] text-neutral-400">{m.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function Tile({
  label,
  value,
  hint,
  badgeClass,
}: {
  label: string;
  value: string;
  hint: string;
  badgeClass?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-neutral-900">{value}</p>
      <p className={`mt-0.5 inline-block rounded-full px-1.5 text-[10px] ${badgeClass ?? "text-neutral-400"}`}>
        {hint}
      </p>
    </div>
  );
}
