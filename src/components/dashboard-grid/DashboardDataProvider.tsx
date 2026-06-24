"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DashboardData } from "./dashboardData";

interface DashboardDataContextValue {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

/** Lädt die aggregierten Dashboard-Daten einmal zentral und stellt sie allen Widgets bereit. */
export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/dashboard/data")
      .then((res) => {
        if (!res.ok) throw new Error("Daten konnten nicht geladen werden.");
        return res.json() as Promise<DashboardData>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({ data, loading, error, refetch }),
    [data, loading, error, refetch],
  );

  return (
    <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
  );
}

export function useDashboardData(): DashboardDataContextValue {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error("useDashboardData muss innerhalb von DashboardDataProvider verwendet werden.");
  }
  return ctx;
}
