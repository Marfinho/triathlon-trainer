export type WidgetSize = "S" | "M" | "L";

export interface WidgetInstance {
  id: string;
  type: string;
  size: WidgetSize;
}

export const WIDGET_SIZES: WidgetSize[] = ["S", "M", "L"];

export const SIZE_LABEL: Record<WidgetSize, string> = {
  S: "Klein",
  M: "Mittel",
  L: "Groß",
};

export const SIZE_SPAN_CLASS: Record<WidgetSize, string> = {
  S: "col-span-1",
  M: "col-span-1 md:col-span-2",
  L: "col-span-1 md:col-span-4",
};

export function isWidgetSize(value: unknown): value is WidgetSize {
  return value === "S" || value === "M" || value === "L";
}

/** Liest `layoutJson` aus der DB robust aus (Prisma liefert `unknown`-artiges JSON). */
export function parseWidgetLayout(json: unknown): WidgetInstance[] {
  if (!json || typeof json !== "object" || !("widgets" in json)) return [];
  const widgets = (json as { widgets?: unknown }).widgets;
  if (!Array.isArray(widgets)) return [];

  const result: WidgetInstance[] = [];
  for (const entry of widgets) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.id === "string" &&
      typeof candidate.type === "string" &&
      isWidgetSize(candidate.size)
    ) {
      result.push({ id: candidate.id, type: candidate.type, size: candidate.size });
    }
  }
  return result;
}
