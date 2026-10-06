import { prisma } from "@/lib/db";
import { decryptApiKey, encryptApiKey } from "@/lib/crypto";
import { refreshOAuthToken } from "@/integrations/oauth/providers";
import { HttpWithingsClient, type WithingsClient } from "./client";

/**
 * Liefert den Withings-Client für einen User:
 *  1. aus dessen UserIntegration (entschlüsselter Access Token),
 *  2. ersatzweise aus den Umgebungsvariablen (Single-User/Dev).
 * Gibt `null` zurück, wenn keine Konfiguration vorhanden ist.
 */
export async function createWithingsClientForUser(
  userId: string,
): Promise<WithingsClient | null> {
  const integration = await prisma.userIntegration.findFirst({
    where: { userId, provider: "withings", enabled: true },
  });

  if (integration?.apiKey) {
    try {
      let accessToken = decryptApiKey(integration.apiKey);

      // Withings-Access-Tokens laufen nach ~3h ab (API meldet dann status 401).
      // Daher vor Ablauf on-demand erneuern und persistieren.
      const expiresSoon =
        integration.tokenExpiresAt &&
        integration.tokenExpiresAt.getTime() < Date.now() + 60_000;
      if (expiresSoon && integration.refreshToken) {
        try {
          const refreshed = await refreshOAuthToken(
            "withings",
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
          accessToken = refreshed.accessToken;
        } catch {
          // Refresh fehlgeschlagen (z.B. widerrufen) -> alter Token; der Import
          // meldet dann den Withings-Fehler.
        }
      }

      return new HttpWithingsClient({
        accessToken,
        baseUrl: process.env.WITHINGS_API_BASE_URL,
      });
    } catch {
      // Decryption fehlgeschlagen -> Fallback auf Env.
    }
  }

  return createWithingsClientFromEnv();
}

function createWithingsClientFromEnv(): HttpWithingsClient | null {
  const accessToken = process.env.WITHINGS_ACCESS_TOKEN;
  if (!accessToken) return null;
  return new HttpWithingsClient({
    accessToken,
    baseUrl: process.env.WITHINGS_API_BASE_URL,
  });
}
