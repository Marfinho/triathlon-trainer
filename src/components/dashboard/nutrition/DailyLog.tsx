"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { DailyBalanceResult } from "@/domain/nutrition/dailyBalance";

export interface FoodLogItem {
  id: string;
  quantityG: number;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  notes: string | null;
  foodProduct: { name: string; brand: string | null; ean: string | null };
}

const STATUS_LABEL: Record<DailyBalanceResult["status"], string> = {
  underfueled: "unterversorgt",
  ok: "im Ziel",
  surplus: "über dem Ziel",
  unknown: "kein Ziel gesetzt",
};

const STATUS_COLOR: Record<DailyBalanceResult["status"], string> = {
  underfueled: "bg-amber-100 text-amber-700",
  ok: "bg-emerald-100 text-emerald-700",
  surplus: "bg-blue-100 text-blue-700",
  unknown: "bg-neutral-200 text-neutral-600",
};

/** Heutige Bilanz (Zufuhr vs. Trainingsverbrauch) + Liste der Logs. */
export function DailyLog({
  balance,
  logs,
  onDeleted,
}: {
  balance: DailyBalanceResult;
  logs: FoodLogItem[];
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function remove(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/nutrition/logs/${id}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted(id);
      } else {
        toast("Löschen fehlgeschlagen.", "error");
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 p-3">
          <span className="text-[11px] uppercase tracking-wide text-neutral-400">Zufuhr</span>
          <p className="mt-0.5 text-xl font-semibold text-neutral-900">{balance.intakeKcal} kcal</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <span className="text-[11px] uppercase tracking-wide text-neutral-400">Training</span>
          <p className="mt-0.5 text-xl font-semibold text-neutral-900">−{balance.burnedKcal} kcal</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <span className="text-[11px] uppercase tracking-wide text-neutral-400">Netto</span>
          <p className="mt-0.5 text-xl font-semibold text-neutral-900">{balance.netKcal} kcal</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <span className="text-[11px] uppercase tracking-wide text-neutral-400">Status</span>
          <p className="mt-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[balance.status]}`}>
              {STATUS_LABEL[balance.status]}
            </span>
          </p>
        </div>
      </div>

      {logs.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {logs.map((log) => (
            <li
              key={log.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
            >
              <span className="text-neutral-700">
                {log.foodProduct.name}
                {log.foodProduct.brand ? (
                  <span className="text-neutral-400"> · {log.foodProduct.brand}</span>
                ) : null}
                <span className="text-neutral-400"> · {log.quantityG} g</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-neutral-500">{Math.round(log.kcal)} kcal</span>
                <button
                  onClick={() => remove(log.id)}
                  disabled={deletingId === log.id}
                  className="text-neutral-300 hover:text-rose-500"
                  aria-label="Eintrag löschen"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-neutral-400">Heute noch keine Einträge.</p>
      )}
    </div>
  );
}
