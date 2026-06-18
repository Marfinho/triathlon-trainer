import { formatIsoDate, addDays, diffInDays, parseIsoDate } from "./dates";

/**
 * Form-Forecast & Taper-Planer (rein/testbar) – das Herzstück der vorausschauen-
 * den Planung.
 *
 * Ausgehend von der aktuellen Fitness (CTL) und Ermüdung (ATL) wird die
 * Performance-Management-Kurve mit Hilfe der bereits GEPLANTEN Workouts in die
 * Zukunft fortgeschrieben. So sieht der Athlet schon heute, mit welcher Form
 * (TSB) er am Renntag ankommt – und bekommt eine konkrete Taper-Empfehlung,
 * um am Wettkampftag frisch und fit zugleich zu sein.
 *
 * Dieselbe exponentielle Fortschreibung wie in `buildLoadSeries`, nur
 * vorwärtsgerichtet auf Plandaten statt rückwärts auf Ist-Daten.
 */

const CTL_TIME_CONSTANT = 42;
const ATL_TIME_CONSTANT = 7;

export interface PlannedLoadDay {
  /** YYYY-MM-DD */
  date: string;
  load: number;
}

export interface ForecastPoint {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
}

export type TaperVerdict = "optimal" | "zu_muede" | "zu_frisch" | "kein_renntag";

export interface FormForecast {
  series: ForecastPoint[];
  raceDay: ForecastPoint | null;
  verdict: TaperVerdict;
  recommendation: string;
}

export interface ForecastInput {
  /** Aktuelle Fitness (CTL) zum Startzeitpunkt. */
  startCtl: number;
  /** Aktuelle Ermüdung (ATL) zum Startzeitpunkt. */
  startAtl: number;
  /** Erster Prognosetag (i. d. R. morgen). */
  startDate: Date | string;
  /** Geplante Tageslasten (fehlende Tage = 0). */
  plannedLoads: PlannedLoadDay[];
  /** Renndatum für die Taper-Bewertung (optional). */
  raceDate?: Date | string | null;
  /** Anzahl Tage, die projiziert werden (Default: bis Renntag bzw. 56). */
  horizonDays?: number;
}

function iso(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : formatIsoDate(value);
}

/**
 * Bewertet die voraussichtliche Renntags-Form. Für die meisten Ausdauer-
 * Wettkämpfe gilt ein TSB im Bereich +5 … +25 als ideal (ausgeruht, ohne die
 * Fitness verloren zu haben).
 */
function evaluateTaper(raceTsb: number): { verdict: TaperVerdict; recommendation: string } {
  if (raceTsb < -5) {
    return {
      verdict: "zu_muede",
      recommendation:
        "Du kommst noch ermüdet ins Rennen (TSB negativ). Reduziere in den letzten 7–10 Tagen das Volumen um 40–60 % bei erhaltener Intensität, um Frische aufzubauen.",
    };
  }
  if (raceTsb > 25) {
    return {
      verdict: "zu_frisch",
      recommendation:
        "Du taperst zu stark – so viel Frische geht auf Kosten der Spritzigkeit. Halte mehr kurze, intensive Reize, um schärfer ins Rennen zu gehen.",
    };
  }
  return {
    verdict: "optimal",
    recommendation:
      "Dein geplanter Taper trifft den optimalen Frische-Korridor (TSB +5…+25). So kommst du ausgeruht und fit am Renntag an.",
  };
}

export function forecastForm(input: ForecastInput): FormForecast {
  const startDate = typeof input.startDate === "string" ? parseIsoDate(input.startDate) : input.startDate;
  const raceDateIso = input.raceDate ? iso(input.raceDate) : null;

  // Horizont bestimmen: bis Renntag (+3 Tage Puffer) oder Default.
  let horizon = input.horizonDays ?? 56;
  if (raceDateIso) {
    const d = diffInDays(startDate, parseIsoDate(raceDateIso));
    if (d >= 0) horizon = Math.max(d + 3, 1);
  }

  const loadByDay = new Map<string, number>();
  for (const p of input.plannedLoads) {
    loadByDay.set(p.date, (loadByDay.get(p.date) ?? 0) + p.load);
  }

  const ctlAlpha = 1 / CTL_TIME_CONSTANT;
  const atlAlpha = 1 / ATL_TIME_CONSTANT;
  let prevCtl = input.startCtl;
  let prevAtl = input.startAtl;

  const series: ForecastPoint[] = [];
  let raceDay: ForecastPoint | null = null;

  for (let i = 0; i < horizon; i++) {
    const dayIso = formatIsoDate(addDays(startDate, i));
    const load = loadByDay.get(dayIso) ?? 0;
    const c = prevCtl + (load - prevCtl) * ctlAlpha;
    const a = prevAtl + (load - prevAtl) * atlAlpha;
    const point: ForecastPoint = {
      date: dayIso,
      ctl: Math.round(c * 10) / 10,
      atl: Math.round(a * 10) / 10,
      tsb: Math.round((c - a) * 10) / 10,
    };
    series.push(point);
    if (raceDateIso && dayIso === raceDateIso) raceDay = point;
    prevCtl = c;
    prevAtl = a;
  }

  if (!raceDay) {
    return {
      series,
      raceDay: null,
      verdict: "kein_renntag",
      recommendation: raceDateIso
        ? "Renntag liegt außerhalb des Prognosehorizonts oder hat keine Plandaten."
        : "Lege ein Hauptrennen an, um eine Taper-Empfehlung zu erhalten.",
    };
  }

  const { verdict, recommendation } = evaluateTaper(raceDay.tsb);
  return { series, raceDay, verdict, recommendation };
}
