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
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">
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
  swim: "#0a84ff",
  bike: "#30b0c7",
  run: "#ff9f0a",
  strength: "#bf5af2",
  brick: "#5e5ce6",
  other: "#8e8e93",
};

export function sportColor(sport: string): string {
  return SPORT_COLORS[sport] ?? "#8e8e93";
}
