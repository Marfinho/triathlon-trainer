import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="card-neon animate-rise rounded-3xl p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-neutral-900">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

const SPORT_LABELS: Record<string, string> = {
  run: "Laufen",
  bike: "Rad",
  swim: "Schwimmen",
  strength: "Kraft",
  brick: "Koppel",
  mobility: "Mobility",
  walk: "Gehen",
  cross_training: "Cross",
  other: "Sonstige",
  rest: "Ruhetag",
};

export function sportLabel(sport: string): string {
  return SPORT_LABELS[sport] ?? sport;
}

/** Einheitliche, dezente Farbzuordnung je Disziplin (für Graphen/Badges). */
export const SPORT_COLORS: Record<string, string> = {
  swim: "#00E5FF",
  bike: "#00FFD1",
  run: "#FF9F1C",
  strength: "#B026FF",
  brick: "#7C4DFF",
  other: "#8E8EAB",
};

export function sportColor(sport: string): string {
  return SPORT_COLORS[sport] ?? "#8E8EAB";
}
