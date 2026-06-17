import { prisma } from "@/lib/db";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto";
import { refreshOAuthToken, type OAuthProviderId } from "./providers";

export interface ConnectionStatus {
  connected: boolean;
  externalId: string | null;
  expiresAt: string | null;
  scope: string | null;
}

/**
 * Liefert den Verbindungsstatus eines OAuth-Providers und erneuert dabei
 * abgelaufene Access-Tokens via Refresh-Token (persistiert das Ergebnis).
 */
export async function getConnectionStatus(
  userId: string,
  provider: OAuthProviderId,
): Promise<ConnectionStatus> {
  const integration = await prisma.userIntegration.findFirst({
    where: { userId, provider, enabled: true },
  });
  if (!integration) {
    return { connected: false, externalId: null, expiresAt: null, scope: null };
  }

  const isExpired = integration.tokenExpiresAt
    ? integration.tokenExpiresAt.getTime() < Date.now()
    : false;

  if (isExpired && integration.refreshToken) {
    try {
      const refreshed = await refreshOAuthToken(provider, decryptApiKey(integration.refreshToken));
      await prisma.userIntegration.update({
        where: { id: integration.id },
        data: {
          apiKey: encryptApiKey(refreshed.accessToken),
          refreshToken: refreshed.refreshToken
            ? encryptApiKey(refreshed.refreshToken)
            : integration.refreshToken,
          tokenExpiresAt: refreshed.expiresAt,
          scope: refreshed.scope ?? integration.scope,
        },
      });
      return {
        connected: true,
        externalId: integration.athleteId,
        expiresAt: refreshed.expiresAt ? refreshed.expiresAt.toISOString() : null,
        scope: refreshed.scope ?? integration.scope,
      };
    } catch {
      // Refresh fehlgeschlagen -> als getrennt anzeigen; Datensatz bleibt für
      // einen erneuten Verbindungsversuch erhalten.
      return { connected: false, externalId: integration.athleteId, expiresAt: null, scope: integration.scope };
    }
  }

  return {
    connected: true,
    externalId: integration.athleteId,
    expiresAt: integration.tokenExpiresAt ? integration.tokenExpiresAt.toISOString() : null,
    scope: integration.scope,
  };
}
