import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getEffectiveLimits } from "@/lib/plan-config";
import { AccountSettings } from "@/components/profile/AccountSettings";
import { AthleteDataForm } from "@/components/profile/AthleteDataForm";
import { IntegrationSettings } from "@/components/profile/IntegrationSettings";
import { OAuthIntegrations } from "@/components/profile/OAuthIntegrations";
import { BillingSection } from "@/components/profile/BillingSection";
import { getConnectionStatus } from "@/integrations/oauth/connectionStatus";
import { getEnabledProviders } from "@/lib/integration-config";
import type { OAuthProviderId } from "@/integrations/oauth/providers";

export const dynamic = "force-dynamic";

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

const INTEGRATION_ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Dieser Anbieter ist serverseitig noch nicht konfiguriert.",
  limit_reached: "Limit für aktive Integrationen erreicht – bitte upgraden.",
  denied: "Verbindung wurde abgelehnt.",
  invalid_state: "Die Anfrage ist abgelaufen oder ungültig. Bitte erneut versuchen.",
  token_exchange_failed: "Verbindung fehlgeschlagen. Bitte erneut versuchen.",
};

const PROVIDER_LABELS: Record<string, string> = {
  strava: "Strava",
  wahoo: "Wahoo",
  withings: "Withings",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  const userId = session.user.id;
  const params = await searchParams;
  const connected = typeof params.connected === "string" ? params.connected : null;
  const integrationError =
    typeof params.integration_error === "string" ? params.integration_error : null;

  const [dbUser, athleteProfile, integration, enabledProviders] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.athleteProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.userIntegration.findFirst({
      where: { userId, provider: "intervals", enabled: true },
    }),
    getEnabledProviders(),
  ]);
  if (!dbUser) redirect("/auth/login");

  const intervalsEnabled = enabledProviders.has("intervals");
  const oauthProviderIds = (["strava", "wahoo", "withings"] as const).filter((p) =>
    enabledProviders.has(p),
  );
  const oauthStatuses = await Promise.all(
    oauthProviderIds.map((p) => getConnectionStatus(userId, p)),
  );
  const oauthProviders = oauthProviderIds.map((provider, i) => ({
    provider: provider as OAuthProviderId,
    label: PROVIDER_LABELS[provider] ?? provider,
    connected: oauthStatuses[i].connected,
    externalId: oauthStatuses[i].externalId,
  }));

  const limits = await getEffectiveLimits(dbUser.plan);
  const activeIntegrations = await prisma.userIntegration.count({
    where: { userId, enabled: true },
  });
  const anyIntegrationEnabled = intervalsEnabled || oauthProviders.length > 0;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-10">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
            LocalHub
          </p>
          <a
            href="/dashboard"
            className="rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 transition hover:border-neutral-300 dark:hover:border-neutral-700 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Zurück zum Dashboard
          </a>
        </div>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Profil & Einstellungen
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
          Account, Athletendaten, Integrationen und Tarif an einem Ort.
        </p>
      </header>

      {(connected || integrationError) && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            connected
              ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
              : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
          }`}
        >
          {connected
            ? `${PROVIDER_LABELS[connected] ?? connected} erfolgreich verbunden.`
            : INTEGRATION_ERROR_MESSAGES[integrationError ?? ""] ?? "Verbindung fehlgeschlagen."}
        </div>
      )}

      <div className="space-y-6">
        <AccountSettings
          name={dbUser.name ?? ""}
          email={dbUser.email}
          canChangePassword={Boolean(dbUser.passwordHash)}
        />

        {athleteProfile && (
          <AthleteDataForm
            initial={{
              name: athleteProfile.name,
              heightCm: athleteProfile.heightCm,
              weightKg: athleteProfile.weightKg,
              ftpWatts: athleteProfile.ftpWatts,
              thresholdHr: athleteProfile.thresholdHr,
              thresholdPaceSecPerKm: athleteProfile.thresholdPaceSecPerKm,
              thresholdSwimPer100m: athleteProfile.thresholdSwimPer100m,
              trainingLevel: athleteProfile.trainingLevel,
              primarySports: jsonStringArray(athleteProfile.primarySports),
              knownLimiters: jsonStringArray(athleteProfile.knownLimiters),
              equipment: jsonStringArray(athleteProfile.equipment),
            }}
          />
        )}

        {intervalsEnabled && (
          <IntegrationSettings
            connected={Boolean(integration)}
            athleteId={integration?.athleteId ?? null}
            maxActiveIntegrations={limits.maxActiveIntegrations}
            activeIntegrations={activeIntegrations}
          />
        )}

        {oauthProviders.length > 0 && (
          <OAuthIntegrations
            providers={oauthProviders}
            maxActiveIntegrations={limits.maxActiveIntegrations}
            activeIntegrations={activeIntegrations}
          />
        )}

        {!anyIntegrationEnabled && (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/60 px-5 py-4 text-sm text-neutral-500 dark:text-neutral-400">
            Aktuell sind keine Integrationen freigeschaltet. Frag deinen
            Administrator, um Quellen wie Intervals.icu, Strava, Wahoo oder
            Withings zu aktivieren.
          </div>
        )}

        <BillingSection
          plan={dbUser.plan}
          planInterval={dbUser.planInterval}
          planExpiresAt={dbUser.planExpiresAt ? dbUser.planExpiresAt.toISOString() : null}
          hasStripeCustomer={Boolean(dbUser.stripeCustomerId)}
        />
      </div>
    </main>
  );
}
