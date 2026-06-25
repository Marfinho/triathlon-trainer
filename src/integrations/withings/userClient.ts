import { prisma } from "@/lib/db";
import { decryptApiKey } from "@/lib/crypto";
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
      return new HttpWithingsClient({
        accessToken: decryptApiKey(integration.apiKey),
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
