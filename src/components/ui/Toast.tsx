"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLE: Record<ToastKind, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-rose-600 text-white",
  info: "bg-neutral-900 text-neutral-50",
};

/**
 * Leichtgewichtige Toast-Benachrichtigungen ohne externe Abhängigkeit. Stellt
 * einen `toast()`-Helfer bereit und rendert die Meldungen unten (mobil über der Tab-Leiste).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-[calc(92px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:items-end"
        role="region"
        aria-label="Benachrichtigungen"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-rise pointer-events-auto rounded-full px-5 py-3 text-sm font-semibold shadow-xl ${KIND_STYLE[t.kind]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Zugriff auf den Toast-Helfer. Außerhalb des Providers eine No-op, damit
 * Komponenten ohne Provider nicht crashen.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  return ctx ?? { toast: () => {} };
}
