/**
 * Sportgeräte-Verschleiß (rein/testbar).
 *
 * Die Nutzung eines Geräts ergibt sich aus manuell erfassten Werten plus –
 * sofern `autoTrack` aktiv ist – der Summe passender Ist-Aktivitäten (gleiche
 * Sportart, ab dem Kauf-/Einbaudatum).
 */

export interface GearUsageActivity {
  date: Date | string;
  sport: string;
  distanceKm: number | null;
  durationMin: number | null;
}

export interface GearComputable {
  sport?: string | null;
  purchaseDate?: Date | string | null;
  autoTrack: boolean;
  manualKm: number;
  manualHours: number;
  alertKm?: number | null;
  alertHours?: number | null;
}

export type WearStatus = "ok" | "due" | "over";

export interface GearUsage {
  km: number;
  hours: number;
  kmPct: number | null;
  hoursPct: number | null;
  status: WearStatus;
}

function toTime(value: Date | string): number {
  return (typeof value === "string" ? new Date(value) : value).getTime();
}

function statusFromPct(pct: number | null): WearStatus {
  if (pct == null) return "ok";
  if (pct >= 1) return "over";
  if (pct >= 0.8) return "due";
  return "ok";
}

function worst(a: WearStatus, b: WearStatus): WearStatus {
  const rank: Record<WearStatus, number> = { ok: 0, due: 1, over: 2 };
  return rank[a] >= rank[b] ? a : b;
}

export interface GearItemRecord extends GearComputable {
  id: string;
  name: string;
  type: string;
  sport: string | null;
  parentId: string | null;
  brand: string | null;
  model: string | null;
  retired: boolean;
  notes: string | null;
}

export interface GearNode {
  id: string;
  name: string;
  type: string;
  sport: string | null;
  parentId: string | null;
  brand: string | null;
  model: string | null;
  purchaseDate: string | null;
  retired: boolean;
  autoTrack: boolean;
  manualKm: number;
  manualHours: number;
  alertKm: number | null;
  alertHours: number | null;
  notes: string | null;
  usage: GearUsage;
  components: GearNode[];
}

/** Baut die Geräte als Baum (Komponenten unter ihrem Eltern-Gerät) inkl. Nutzung. */
export function buildGearTree(
  items: GearItemRecord[],
  activities: GearUsageActivity[],
): GearNode[] {
  const nodes = new Map<string, GearNode>();
  for (const g of items) {
    nodes.set(g.id, {
      id: g.id,
      name: g.name,
      type: g.type,
      sport: g.sport ?? null,
      parentId: g.parentId ?? null,
      brand: g.brand,
      model: g.model,
      purchaseDate:
        g.purchaseDate == null
          ? null
          : typeof g.purchaseDate === "string"
            ? g.purchaseDate
            : g.purchaseDate.toISOString(),
      retired: g.retired,
      autoTrack: g.autoTrack,
      manualKm: g.manualKm,
      manualHours: g.manualHours,
      alertKm: g.alertKm ?? null,
      alertHours: g.alertHours ?? null,
      notes: g.notes,
      usage: computeGearUsage(g, activities),
      components: [],
    });
  }
  const roots: GearNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.components.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function computeGearUsage(
  gear: GearComputable,
  activities: GearUsageActivity[],
): GearUsage {
  let km = gear.manualKm ?? 0;
  let hours = gear.manualHours ?? 0;

  if (gear.autoTrack && gear.sport) {
    const since = gear.purchaseDate ? toTime(gear.purchaseDate) : -Infinity;
    for (const a of activities) {
      if (a.sport !== gear.sport) continue;
      if (toTime(a.date) < since) continue;
      km += a.distanceKm ?? 0;
      hours += (a.durationMin ?? 0) / 60;
    }
  }

  km = Math.round(km * 10) / 10;
  hours = Math.round(hours * 10) / 10;

  const kmPct =
    gear.alertKm && gear.alertKm > 0 ? km / gear.alertKm : null;
  const hoursPct =
    gear.alertHours && gear.alertHours > 0 ? hours / gear.alertHours : null;
  const status = worst(statusFromPct(kmPct), statusFromPct(hoursPct));

  return {
    km,
    hours,
    kmPct: kmPct != null ? Math.round(kmPct * 100) / 100 : null,
    hoursPct: hoursPct != null ? Math.round(hoursPct * 100) / 100 : null,
    status,
  };
}
