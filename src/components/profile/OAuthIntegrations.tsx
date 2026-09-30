"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/dashboard/Card";

export interface OAuthProviderStatus {
  provider: "strava" | "wahoo" | "withings";
  label: string;
  connected: boolean;
  externalId: string | null;
}

export function OAuthIntegrations({
  providers,
  maxActiveIntegrations,
  activeIntegrations,
}: {
  providers: OAuthProviderStatus[];
  maxActiveIntegrations: number;
  activeIntegrations: number;
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  async function disconnect(provider: string) {
    setDisconnecting(provider);
    try {
      await fetch(`/api/integrations/${provider}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <Card title="Weitere Quellen" subtitle="OAuth-Verbindungen zu Strava, Wahoo und Withings">
      <div className="space-y-3">
        {providers.map((p) => {
          const atLimit =
            !p.connected && Number.isFinite(maxActiveIntegrations) && activeIntegrations >= maxActiveIntegrations;
          return (
            <div
              key={p.provider}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">{p.label}</p>
                {p.connected ? (
                  <p className="mt-0.5 text-xs text-neutral-400">
                    Verbunden{p.externalId ? ` · ID ${p.externalId}` : ""}
                  </p>
                ) : atLimit ? (
                  <p className="mt-0.5 text-xs text-amber-700">
                    Limit erreicht – Upgrade für weitere Integrationen.
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-neutral-400">Nicht verbunden</p>
                )}
              </div>
              {p.connected ? (
                <button
                  onClick={() => disconnect(p.provider)}
                  disabled={disconnecting === p.provider}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:border-red-300 disabled:opacity-40"
                >
                  {disconnecting === p.provider ? "…" : "Trennen"}
                </button>
              ) : (
                <a
                  href={atLimit ? undefined : `/api/integrations/${p.provider}/connect`}
                  aria-disabled={atLimit}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
                    atLimit ? "cursor-not-allowed bg-neutral-300" : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  Verbinden
                </a>
              )}
            </div>
          );
        })}
        <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-3">
          <p className="text-sm font-medium text-neutral-500">Garmin</p>
          <p className="mt-0.5 text-xs text-neutral-400">
            Garmin bietet keine Self-Service-API – Aktivitäten lassen sich stattdessen über
            Intervals.icu importieren, das Garmin bereits anbindet.
          </p>
        </div>
      </div>
    </Card>
  );
}
