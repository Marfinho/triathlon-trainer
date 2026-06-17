/**
 * Server-only: global vom Admin verwaltete Integrationskonfiguration.
 *
 * Quelle der Wahrheit ist die Tabelle `IntegrationConfig`. Eine Integration ist
 * für Nutzer nur verfügbar, wenn dort `enabled = true` gesetzt ist – d.h. ohne
 * Admin-Konfiguration sind alle Integrationen deaktiviert.
 *
 * Für OAuth-Provider werden Client-ID/Secret aus der DB gelesen; fehlen sie
 * dort, dienen die `*_CLIENT_ID`/`*_CLIENT_SECRET`-Env-Variablen als Fallback
 * (bequeme Bootstrap-Quelle). Das `enabled`-Gate hängt jedoch ausschließlich
 * an der DB.
 */
import { prisma } from "@/lib/db";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto";

export type IntegrationKind = "oauth" | "apikey";

export interface IntegrationProviderMeta {
  provider: string;
  label: string;
  kind: IntegrationKind;
  description: string;
}

/** Bekannte, im Adminbereich konfigurierbare Integrationen. */
export const INTEGRATION_PROVIDERS: IntegrationProviderMeta[] = [
  {
    provider: "intervals",
    label: "Intervals.icu",
    kind: "apikey",
    description:
      "Aktivitäts-Drehscheibe. Keine globalen Zugangsdaten nötig – Nutzer hinterlegen ihren persönlichen API-Key im Profil.",
  },
  {
    provider: "strava",
    label: "Strava",
    kind: "oauth",
    description: "OAuth2 – Client-ID & Secret aus dem Strava-API-Portal erforderlich.",
  },
  {
    provider: "wahoo",
    label: "Wahoo",
    kind: "oauth",
    description: "OAuth2 – Client-ID & Secret aus dem Wahoo-Cloud-Portal erforderlich.",
  },
  {
    provider: "withings",
    label: "Withings",
    kind: "oauth",
    description: "OAuth2 – Client-ID & Secret aus dem Withings-Developer-Portal erforderlich.",
  },
];

const PROVIDER_BY_ID = new Map(INTEGRATION_PROVIDERS.map((p) => [p.provider, p]));

export function isKnownProvider(provider: string): boolean {
  return PROVIDER_BY_ID.has(provider);
}

/** Env-Fallback für OAuth-Credentials (nur Credentials, nicht das enabled-Gate). */
function envCredentials(provider: string): { clientId?: string; clientSecret?: string } {
  switch (provider) {
    case "strava":
      return { clientId: process.env.STRAVA_CLIENT_ID, clientSecret: process.env.STRAVA_CLIENT_SECRET };
    case "wahoo":
      return { clientId: process.env.WAHOO_CLIENT_ID, clientSecret: process.env.WAHOO_CLIENT_SECRET };
    case "withings":
      return { clientId: process.env.WITHINGS_CLIENT_ID, clientSecret: process.env.WITHINGS_CLIENT_SECRET };
    default:
      return {};
  }
}

export interface IntegrationRuntime {
  provider: string;
  enabled: boolean;
  clientId: string | undefined;
  clientSecret: string | undefined;
}

/**
 * Laufzeit-Konfiguration eines Providers (server-only). `enabled` kommt aus der
 * DB (Default: deaktiviert). Credentials kommen aus der DB, ersatzweise aus den
 * Env-Variablen. Fällt bei DB-Fehlern auf "deaktiviert" zurück.
 */
export async function getIntegrationRuntime(provider: string): Promise<IntegrationRuntime> {
  let row: { enabled: boolean; clientId: string | null; clientSecret: string | null } | null = null;
  try {
    row = await prisma.integrationConfig.findUnique({
      where: { provider },
      select: { enabled: true, clientId: true, clientSecret: true },
    });
  } catch {
    row = null;
  }

  const env = envCredentials(provider);
  const clientId = (row?.clientId && row.clientId.length > 0 ? row.clientId : undefined) ?? env.clientId ?? undefined;

  let clientSecret: string | undefined;
  if (row?.clientSecret) {
    try {
      clientSecret = decryptApiKey(row.clientSecret);
    } catch {
      clientSecret = undefined;
    }
  }
  if (!clientSecret) clientSecret = env.clientSecret ?? undefined;

  return {
    provider,
    enabled: row?.enabled ?? false,
    clientId: clientId || undefined,
    clientSecret: clientSecret || undefined,
  };
}

/** Menge der aktuell vom Admin aktivierten Provider. */
export async function getEnabledProviders(): Promise<Set<string>> {
  try {
    const rows = await prisma.integrationConfig.findMany({
      where: { enabled: true },
      select: { provider: true },
    });
    return new Set(rows.map((r) => r.provider));
  } catch {
    return new Set();
  }
}

export interface IntegrationConfigView extends IntegrationProviderMeta {
  enabled: boolean;
  clientId: string;
  hasSecret: boolean;
  /** true, wenn Credentials (noch) aus Env-Variablen stammen statt aus der DB. */
  usesEnvFallback: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Adminsicht aller Integrationen – Secret wird nie im Klartext ausgegeben. */
export async function listIntegrationConfigViews(): Promise<IntegrationConfigView[]> {
  let rows: Array<{
    provider: string;
    enabled: boolean;
    clientId: string | null;
    clientSecret: string | null;
    updatedAt: Date;
    updatedBy: string | null;
  }> = [];
  try {
    rows = await prisma.integrationConfig.findMany();
  } catch {
    rows = [];
  }
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  return INTEGRATION_PROVIDERS.map((meta) => {
    const row = byProvider.get(meta.provider);
    const env = envCredentials(meta.provider);
    const hasDbSecret = Boolean(row?.clientSecret);
    const hasEnvSecret = Boolean(env.clientSecret);
    const dbClientId = row?.clientId ?? "";
    return {
      ...meta,
      enabled: row?.enabled ?? false,
      clientId: dbClientId || (env.clientId ?? ""),
      hasSecret: hasDbSecret || hasEnvSecret,
      usesEnvFallback: meta.kind === "oauth" && !hasDbSecret && hasEnvSecret,
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
      updatedBy: row?.updatedBy ?? null,
    };
  });
}

export interface SetIntegrationConfigInput {
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string;
  clearSecret?: boolean;
}

/**
 * Schreibt/aktualisiert die Konfiguration eines Providers. Das Secret wird nur
 * gesetzt, wenn ein nicht-leerer Wert übergeben wird; `clearSecret` entfernt es.
 */
export async function setIntegrationConfig(
  provider: string,
  input: SetIntegrationConfigInput,
  updatedBy?: string,
): Promise<IntegrationConfigView> {
  if (!isKnownProvider(provider)) {
    throw new Error(`Unbekannter Provider: ${provider}`);
  }

  const data: {
    enabled?: boolean;
    clientId?: string | null;
    clientSecret?: string | null;
    updatedBy?: string | null;
  } = { updatedBy: updatedBy ?? null };

  if (typeof input.enabled === "boolean") data.enabled = input.enabled;
  if (typeof input.clientId === "string") data.clientId = input.clientId.trim() || null;
  if (input.clearSecret) {
    data.clientSecret = null;
  } else if (typeof input.clientSecret === "string" && input.clientSecret.trim().length > 0) {
    data.clientSecret = encryptApiKey(input.clientSecret.trim());
  }

  await prisma.integrationConfig.upsert({
    where: { provider },
    create: {
      provider,
      enabled: data.enabled ?? false,
      clientId: data.clientId ?? null,
      clientSecret: data.clientSecret ?? null,
      updatedBy: data.updatedBy ?? null,
    },
    update: data,
  });

  const views = await listIntegrationConfigViews();
  return views.find((v) => v.provider === provider)!;
}
