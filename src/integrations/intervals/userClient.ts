import { prisma } from "@/lib/db";
import { decryptApiKey } from "@/lib/crypto";
import {
  HttpIntervalsClient,
  createIntervalsClientFromEnv,
  type IntervalsClient,
} from "./client";

/**
 * Liefert den Intervals.icu-Client für einen User:
 *  1. aus dessen UserIntegration (entschlüsselter API-Key),
 *  2. ersatzweise aus den Umgebungsvariablen (Single-User/Dev).
 * Gibt `null` zurück, wenn keine Konfiguration vorhanden ist.
 */
export async function createIntervalsClientForUser(
  userId: string,
): Promise<IntervalsClient | null> {
  const integration = await prisma.userIntegration.findFirst({
    where: { userId, provider: "intervals", enabled: true },
  });

  if (integration?.apiKey && integration.athleteId) {
    try {
      return new HttpIntervalsClient({
        athleteId: integration.athleteId,
        apiKey: decryptApiKey(integration.apiKey),
        baseUrl: process.env.INTERVALS_API_BASE_URL,
      });
    } catch {
      // Entschlüsselung fehlgeschlagen -> Fallback auf Env.
    }
  }

  return createIntervalsClientFromEnv();
}
