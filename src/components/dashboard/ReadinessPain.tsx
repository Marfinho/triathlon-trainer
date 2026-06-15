import { Card } from "./Card";

export interface ReadinessData {
  date: string;
  status: string | null;
  sleepTrend: string | null;
  hrvTrend: string | null;
  restingHrTrend: string | null;
  subjectiveFatigue: number | null;
  notes: string | null;
}

export interface PainData {
  date: string;
  overall: number | null;
  knee: number | null;
  achilles: number | null;
  calf: number | null;
  back: number | null;
  notes: string | null;
}

const READINESS_DOT: Record<string, string> = {
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  red: "bg-rose-400",
};

export function ReadinessPain({
  readiness,
  pain,
}: {
  readiness: ReadinessData | null;
  pain: PainData | null;
}) {
  return (
    <Card title="Readiness & Schmerz" subtitle="Letzter erfasster Stand">
      {!readiness && !pain ? (
        <p className="text-sm text-slate-500">Keine Daten erfasst.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Readiness
              {readiness?.status ? (
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    READINESS_DOT[readiness.status] ?? "bg-slate-500"
                  }`}
                />
              ) : null}
            </h3>
            {readiness ? (
              <ul className="space-y-1 text-sm text-slate-300">
                <li>Status: {readiness.status ?? "—"}</li>
                <li>Schlaf: {readiness.sleepTrend ?? "—"}</li>
                <li>HRV: {readiness.hrvTrend ?? "—"}</li>
                <li>Ruhe-HF: {readiness.restingHrTrend ?? "—"}</li>
                <li>Subj. Müdigkeit: {readiness.subjectiveFatigue ?? "—"}</li>
              </ul>
            ) : (
              <p className="text-sm text-slate-500">—</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Schmerzstatus
            </h3>
            {pain ? (
              <ul className="space-y-1 text-sm text-slate-300">
                <li>Gesamt: {pain.overall ?? "—"}</li>
                <li>Knie: {pain.knee ?? "—"}</li>
                <li>Achilles: {pain.achilles ?? "—"}</li>
                <li>Wade: {pain.calf ?? "—"}</li>
                <li>Rücken: {pain.back ?? "—"}</li>
              </ul>
            ) : (
              <p className="text-sm text-slate-500">—</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
