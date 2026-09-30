"use client";

import type { GearNode } from "@/domain/training/gear";
import { useDashboardData } from "../DashboardDataProvider";
import type { WidgetSize } from "../types";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./WidgetStates";

const STATUS_LABEL: Record<string, string> = {
  ok: "ok",
  due: "bald fällig",
  over: "Wechsel fällig",
};

const STATUS_COLOR: Record<string, string> = {
  ok: "text-emerald-600",
  due: "text-amber-600",
  over: "text-rose-600",
};

function flatten(nodes: GearNode[]): GearNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.components)]);
}

export function GearWear({ size }: { size: WidgetSize }) {
  const { data, loading, error } = useDashboardData();

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;
  if (!data) return null;

  const items = flatten(data.gear.tree).filter((n) => !n.retired);
  if (items.length === 0) {
    return <WidgetEmpty message="Noch keine Ausrüstung erfasst." />;
  }

  const dueOrOver = items.filter((n) => n.usage.status !== "ok");

  if (size === "S") {
    return (
      <p className="text-sm text-neutral-700">
        {dueOrOver.length > 0
          ? `${dueOrOver.length} Gerät${dueOrOver.length === 1 ? "" : "e"} fällig`
          : "Alles im grünen Bereich"}
      </p>
    );
  }

  const visible = size === "L" ? items : items.slice(0, 4);

  return (
    <div className="space-y-1.5">
      {visible.map((n) => (
        <div key={n.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-neutral-600">{n.name}</span>
          <span className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400">{Math.round(n.usage.km)} km</span>
            <span className={STATUS_COLOR[n.usage.status]}>
              {STATUS_LABEL[n.usage.status]}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
