/**
 * Erzeugt einen kopier-/teilbaren Wochenbericht als Markdown (rein/testbar).
 */

export interface WeeklyReportInput {
  weekStart: string;
  form: { ctl: number; atl: number; tsb: number };
  bySport: { sport: string; min: number; km: number; sessions: number }[];
  compliancePct: number | null;
  goals: { sport: string; actualMin: number; targetMin: number }[];
}

const SPORT_LABELS: Record<string, string> = {
  run: "Laufen",
  bike: "Rad",
  swim: "Schwimmen",
  strength: "Kraft",
  brick: "Koppel",
};

function label(sport: string): string {
  return SPORT_LABELS[sport] ?? sport;
}

export function buildWeeklyReport(input: WeeklyReportInput): string {
  const totalMin = input.bySport.reduce((s, x) => s + x.min, 0);
  const totalSessions = input.bySport.reduce((s, x) => s + x.sessions, 0);

  const lines: string[] = [];
  lines.push(`# Wochenbericht ab ${input.weekStart}`);
  lines.push("");
  lines.push(
    `**Umfang:** ${(totalMin / 60).toFixed(1)} h · ${totalSessions} Einheiten`,
  );
  if (input.compliancePct != null) {
    lines.push(`**Plan-Compliance:** ${input.compliancePct} %`);
  }
  lines.push(
    `**Form:** Fitness ${Math.round(input.form.ctl)} · Ermüdung ${Math.round(
      input.form.atl,
    )} · Form ${Math.round(input.form.tsb)}`,
  );
  lines.push("");
  lines.push("## Disziplinen");
  if (input.bySport.length === 0) {
    lines.push("_keine Aktivitäten_");
  } else {
    lines.push("| Disziplin | Einheiten | Zeit | Distanz |");
    lines.push("| --- | ---: | ---: | ---: |");
    for (const s of input.bySport) {
      lines.push(
        `| ${label(s.sport)} | ${s.sessions} | ${(s.min / 60).toFixed(1)} h | ${
          s.km ? `${Math.round(s.km)} km` : "–"
        } |`,
      );
    }
  }

  if (input.goals.length > 0) {
    lines.push("");
    lines.push("## Wochenziele");
    for (const g of input.goals) {
      const pct = g.targetMin
        ? Math.round((g.actualMin / g.targetMin) * 100)
        : 0;
      lines.push(
        `- ${label(g.sport)}: ${(g.actualMin / 60).toFixed(1)} / ${(
          g.targetMin / 60
        ).toFixed(1)} h (${pct} %)`,
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}
