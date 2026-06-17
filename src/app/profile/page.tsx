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

  const [dbUser, athleteProfile, integration, stravaStatus, wahooStatus, withingsStatus] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.athleteProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.userIntegration.findFirst({
        where: { userId, provider: "intervals", enabled: true },
      }),
      getConnectionStatus(userId, "strava"),
      getConnectionStatus(userId, "wahoo"),
      getConnectionStatus(userId, "withings"),
    ]);
  if (!dbUser) redirect("/auth/login");

  const limits = await getEffectiveLimits(dbUser.plan);
  const activeIntegrations = await prisma.userIntegration.count({
    where: { userId, enabled: true },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-10">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            LocalHub
          </p>
          <a
            href="/dashboard"
            className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
          >
            Zurück zum Dashboard
          </a>
        </div>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-neutral-900">
          Profil & Einstellungen
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Account, Athletendaten, Integrationen und Tarif an einem Ort.
        </p>
      </header>

      {(connected || integrationError) && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            connected
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
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

        <IntegrationSettings
          connected={Boolean(integration)}
          athleteId={integration?.athleteId ?? null}
          maxActiveIntegrations={limits.maxActiveIntegrations}
          activeIntegrations={activeIntegrations}
        />

        <OAuthIntegrations
          providers={[
            { provider: "strava", label: "Strava", connected: stravaStatus.connected, externalId: stravaStatus.externalId },
            { provider: "wahoo", label: "Wahoo", connected: wahooStatus.connected, externalId: wahooStatus.externalId },
            { provider: "withings", label: "Withings", connected: withingsStatus.connected, externalId: withingsStatus.externalId },
          ]}
          maxActiveIntegrations={limits.maxActiveIntegrations}
          activeIntegrations={activeIntegrations}
        />

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
