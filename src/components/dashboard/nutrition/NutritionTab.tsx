"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/dashboard/Card";
import { SkeletonLines } from "@/components/ui/Skeleton";
import { NutritionConsent } from "./NutritionConsent";
import { DailyLog, type FoodLogItem } from "./DailyLog";
import { FoodSearch } from "./FoodSearch";
import { NutritionTargets, type NutritionTargetData } from "./NutritionTargets";
import { ForecastPanel } from "./ForecastPanel";
import { buildFuelingHints } from "@/domain/nutrition/heuristics";
import type { DailyBalanceResult } from "@/domain/nutrition/dailyBalance";
import type { DailyEnergyForecast } from "@/domain/nutrition/forecast";

type LoadState = "checking" | "needs_consent" | "ready" | "error";

/**
 * Ernährungs-Tab: Einwilligung, heutige Bilanz (Zufuhr vs. Trainingsverbrauch),
 * Produktsuche/-logging, Tagesziel und Energie-Forecast für die kommenden
 * Einheiten. Alles über die /api/nutrition/*-Routen, die ihrerseits die
 * Einwilligung serverseitig erzwingen.
 */
export function NutritionTab() {
  const [state, setState] = useState<LoadState>("checking");
  const [balance, setBalance] = useState<DailyBalanceResult | null>(null);
  const [logs, setLogs] = useState<FoodLogItem[]>([]);
  const [target, setTarget] = useState<NutritionTargetData | null>(null);
  const [byDayForecast, setByDayForecast] = useState<DailyEnergyForecast[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [balanceRes, logsRes, targetRes, forecastRes] = await Promise.all([
        fetch("/api/nutrition/balance/today"),
        fetch("/api/nutrition/logs"),
        fetch("/api/nutrition/targets"),
        fetch("/api/nutrition/balance/forecast?days=3"),
      ]);
      if (!balanceRes.ok || !logsRes.ok || !targetRes.ok || !forecastRes.ok) {
        setState("error");
        return;
      }
      const [balanceData, logsData, targetData, forecastData] = await Promise.all([
        balanceRes.json(),
        logsRes.json(),
        targetRes.json(),
        forecastRes.json(),
      ]);
      setBalance(balanceData.balance);
      setLogs(logsData.logs ?? []);
      setTarget(targetData.target);
      setByDayForecast(forecastData.byDay ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/nutrition/consent");
        const data = await res.json();
        if (data.nutritionConsentAt) {
          await loadData();
        } else {
          setState("needs_consent");
        }
      } catch {
        setState("error");
      }
    })();
  }, [loadData]);

  function onLogDeleted(id: string) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    loadData();
  }

  if (state === "checking") {
    return (
      <Card title="Ernährung" subtitle="Lädt…">
        <SkeletonLines lines={4} />
      </Card>
    );
  }

  if (state === "needs_consent") {
    return <NutritionConsent onGranted={loadData} />;
  }

  if (state === "error" || !balance) {
    return (
      <Card title="Ernährung">
        <p className="text-sm text-rose-600">
          Daten konnten nicht geladen werden.{" "}
          <button onClick={loadData} className="underline">
            Erneut versuchen
          </button>
        </p>
      </Card>
    );
  }

  const hints = buildFuelingHints(balance, byDayForecast);

  return (
    <>
      <Card
        title="Ernährung heute"
        subtitle="Zufuhr aus geloggten Lebensmitteln vs. Trainingsverbrauch – kein automatischer Grundumsatz"
        actions={
          <NutritionTargets
            initial={target}
            onSaved={(t) => {
              setTarget(t);
              loadData();
            }}
          />
        }
      >
        <DailyLog balance={balance} logs={logs} onDeleted={onLogDeleted} />
        <div className="mt-3">
          <FoodSearch onLogged={loadData} />
        </div>
      </Card>

      <Card
        title="Energie-Forecast"
        subtitle="Geschätzter Bedarf der nächsten 3 Tage – keine Plananpassung, nur Orientierung"
      >
        <ForecastPanel byDay={byDayForecast} hints={hints} />
      </Card>
    </>
  );
}
