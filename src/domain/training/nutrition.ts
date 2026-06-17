/**
 * Wettkampf-Verpflegung: einfache, sportwissenschaftlich grob plausible
 * Faustregeln zur Vorbefüllung des Verpflegungsplans (carbs/fluid/sodium pro
 * Stunde), abhängig von der erwarteten Renndauer. Der Nutzer kann die Werte
 * danach frei überschreiben – das hier ist nur ein Startpunkt, keine
 * medizinische Beratung.
 */

export interface NutritionTargets {
  carbsGPerHour: number;
  fluidMlPerHour: number;
  sodiumMgPerHour: number;
  caffeineMg: number;
}

export function suggestNutritionTargets(durationMin: number): NutritionTargets {
  if (durationMin <= 60) {
    return { carbsGPerHour: 30, fluidMlPerHour: 500, sodiumMgPerHour: 400, caffeineMg: 0 };
  }
  if (durationMin <= 150) {
    return { carbsGPerHour: 60, fluidMlPerHour: 600, sodiumMgPerHour: 500, caffeineMg: 50 };
  }
  return { carbsGPerHour: 90, fluidMlPerHour: 750, sodiumMgPerHour: 700, caffeineMg: 100 };
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

const COMMON_ITEMS = ["Startunterlagen/Startnummer", "Wettervorhersage geprüft", "Wecker gestellt"];

const TYPE_ITEMS: Record<string, string[]> = {
  triathlon: [
    "Neoprenanzug",
    "Schwimmbrille (+ Ersatz)",
    "Rad inkl. Verpflegungshalterung gecheckt",
    "Helm",
    "Laufschuhe",
    "Wechselbeutel gepackt",
    "Gels/Riegel für Rad & Lauf",
  ],
  bike: ["Rad gecheckt (Reifendruck, Kette)", "Helm", "Flaschen/Gels gepackt", "Ersatzschlauch/CO2"],
  run: ["Laufschuhe eingelaufen", "Gels/Riegel gepackt", "Pacing-Plan ausgedruckt"],
  swim: ["Schwimmbrille (+ Ersatz)", "Neoprenanzug (falls erlaubt)", "Badekappe"],
};

/** Sport-spezifische Standard-Checkliste als Ausgangspunkt für den Wettkampftag. */
export function buildDefaultChecklist(type: string): ChecklistItem[] {
  const items = [...(TYPE_ITEMS[type] ?? TYPE_ITEMS.triathlon), ...COMMON_ITEMS];
  return items.map((label) => ({ label, done: false }));
}
