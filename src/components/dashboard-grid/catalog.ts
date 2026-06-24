import type { WidgetSize } from "./types";

export type WidgetCategory = "Täglich" | "Woche" | "Wettkampf" | "Analyse" | "System";

export interface WidgetCatalogEntry {
  type: string;
  label: string;
  category: WidgetCategory;
  description: string;
  defaultSize: WidgetSize;
}

/** Katalog aller verfügbaren Widget-Typen (Inhalte folgen in späteren Schritten). */
export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { type: "TodayWorkout", label: "Heutiges Training", category: "Täglich", description: "Geplantes und absolviertes Training von heute.", defaultSize: "M" },
  { type: "FormGauge", label: "Form", category: "Täglich", description: "Aktuelle Form (TSB) auf einen Blick.", defaultSize: "S" },
  { type: "ReadinessCheckin", label: "Readiness-Check-in", category: "Täglich", description: "Schlaf, HRV und subjektives Befinden.", defaultSize: "S" },
  { type: "WeekCalendar", label: "Wochenkalender", category: "Woche", description: "Trainingsplan der aktuellen Woche.", defaultSize: "L" },
  { type: "Compliance", label: "Planerfüllung", category: "Woche", description: "Plan vs. Ist der letzten Wochen.", defaultSize: "M" },
  { type: "VolumeByDiscipline", label: "Volumen nach Disziplin", category: "Woche", description: "Trainingsminuten je Sportart.", defaultSize: "M" },
  { type: "NextRace", label: "Nächster Wettkampf", category: "Wettkampf", description: "Countdown und Details zum nächsten Rennen.", defaultSize: "M" },
  { type: "TaperForecast", label: "Taper-Prognose", category: "Wettkampf", description: "Form-Verlauf bis zum Wettkampftag.", defaultSize: "M" },
  { type: "RacePrediction", label: "Zielzeit-Prognose", category: "Wettkampf", description: "Geschätzte Zielzeiten je Distanz.", defaultSize: "M" },
  { type: "RaceWeather", label: "Wettkampf-Wetter", category: "Wettkampf", description: "Wettervorhersage am Wettkampfort.", defaultSize: "S" },
  { type: "CTLChart", label: "Fitness-Verlauf (CTL)", category: "Analyse", description: "Langzeit-Trainingsbelastung.", defaultSize: "L" },
  { type: "IntensityDistribution", label: "Intensitätsverteilung", category: "Analyse", description: "Verteilung der Trainingszonen.", defaultSize: "M" },
  { type: "SeasonStats", label: "Saison-Statistik", category: "Analyse", description: "Summen und Bestleistungen der Saison.", defaultSize: "M" },
  { type: "CoachSummary", label: "Coach-Zusammenfassung", category: "Analyse", description: "KI-gestützte Einschätzung der letzten Tage.", defaultSize: "L" },
  { type: "IntervalsSyncStatus", label: "Intervals-Sync", category: "System", description: "Status der Intervals.icu-Synchronisierung.", defaultSize: "S" },
  { type: "BodyMetrics", label: "Körperwerte", category: "System", description: "Gewicht, Ruhepuls und HRV im Verlauf.", defaultSize: "M" },
  { type: "GearWear", label: "Material-Verschleiß", category: "System", description: "Laufleistung und Verschleiß der Ausrüstung.", defaultSize: "S" },
];

export function catalogEntry(type: string): WidgetCatalogEntry | undefined {
  return WIDGET_CATALOG.find((w) => w.type === type);
}
