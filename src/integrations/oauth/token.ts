import { prisma } from "@/lib/db";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto";
import { refreshOAuthToken, type OAuthProviderId } from "./providers";

/** Sicherheitspuffer: Token wird als abgelaufen behandelt, kurz bevor es das ist. */
const EXPIRY_BUFFER_MS = 60_000;

/**
 * Liefert einen gültigen OAuth-Access-Token für `userId`+`provider` und erneuert
 * ihn bei Bedarf via Refresh-Token (persistiert das Ergebnis verschlüsselt).
 *
 * Gibt `null` zurück, wenn keine aktive Integration existiert oder der Refresh
 * fehlschlägt – der DB-Datensatz bleibt dabei für einen späteren Versuch erhalten.
 */
export async function getValidAccessToken(
  userId: string,
  provider: OAuthProviderId,
): Promise<string | null> {
  const integration = await prisma.userIntegration.findFirst({
    where: { userId, provider, enabled: true },
  });
  if (!integration) return null;

  const isExpired = integration.tokenExpiresAt
    ? integration.tokenExpiresAt.getTime() < Date.now() + EXPIRY_BUFFER_MS
    : false;

  if (!isExpired || !integration.refreshToken) {
    try {
      return decryptApiKey(integration.apiKey);
    } catch {
      return null;
    }
  }

  try {
    const refreshed = await refreshOAuthToken(
      provider,
      decryptApiKey(integration.refreshToken),
    );
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
    return refreshed.accessToken;
  } catch {
    return null;
  }
}
