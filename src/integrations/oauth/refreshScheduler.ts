/**
 * Proaktiver OAuth-Token-Refresh für Cron-Läufe: erneuert Access-Tokens schon
 * kurz vor Ablauf, statt erst beim nächsten Statuscheck/Sync auf einen
 * abgelaufenen Token zu stoßen (bisheriges Verhalten in `connectionStatus.ts`).
 */
import type { PrismaClient } from "@prisma/client";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto";
import { refreshOAuthToken, type OAuthProviderId } from "./providers";

const OAUTH_PROVIDERS: OAuthProviderId[] = ["strava", "wahoo", "withings"];

export interface RefreshExpiringTokensResult {
  checked: number;
  refreshed: number;
  failed: number;
}

/**
 * Erneuert alle aktivierten OAuth-Integrationen, deren Access-Token innerhalb
 * von `thresholdMs` abläuft (Default 15 Minuten) und für die ein
 * Refresh-Token vorliegt. Fehler pro Integration werden isoliert (z.B.
 * widerrufener Zugriff) und brechen den Lauf für andere User nicht ab.
 */
export async function refreshExpiringTokens(
  db: PrismaClient,
  thresholdMs = 15 * 60_000,
): Promise<RefreshExpiringTokensResult> {
  const threshold = new Date(Date.now() + thresholdMs);
  const integrations = await db.userIntegration.findMany({
    where: {
      provider: { in: OAUTH_PROVIDERS },
      enabled: true,
      refreshToken: { not: null },
      tokenExpiresAt: { lte: threshold },
    },
  });

  let refreshed = 0;
  let failed = 0;

  for (const integration of integrations) {
    if (!integration.refreshToken) continue;
    try {
      const result = await refreshOAuthToken(
        integration.provider as OAuthProviderId,
        decryptApiKey(integration.refreshToken),
      );
      await db.userIntegration.update({
        where: { id: integration.id },
        data: {
          apiKey: encryptApiKey(result.accessToken),
          refreshToken: result.refreshToken
            ? encryptApiKey(result.refreshToken)
            : integration.refreshToken,
          tokenExpiresAt: result.expiresAt,
          scope: result.scope ?? integration.scope,
        },
      });
      refreshed++;
    } catch {
      // Refresh fehlgeschlagen (z.B. widerrufener Zugriff) -> Integration
      // bleibt unverändert; nächster Versuch beim nächsten Cron-Lauf oder
      // On-Demand-Check in connectionStatus.ts.
      failed++;
    }
  }

  return { checked: integrations.length, refreshed, failed };
}
