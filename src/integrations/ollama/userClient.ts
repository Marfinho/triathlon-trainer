/**
 * Ollama-Client-Fabrik: Lade Ollama-Config für einen Nutzer und instantiiere
 * einen gebrauchsfertigen HTTP-Client mit seinen Zugangsdaten.
 */

import { prisma } from "@/lib/db";
import { decryptApiKey } from "@/lib/crypto";
import { HttpOllamaClient, type OllamaClient } from "./client";

/**
 * Erstelle einen OllamaClient für einen Nutzer (falls aktiviert).
 * Gibt null zurück, falls die Ollama-Integration für diesen Nutzer nicht
 * aktiviert ist oder die Konfiguration unvollständig ist.
 */
export async function createOllamaClientForUser(
  userId: string,
): Promise<OllamaClient | null> {
  // Prüfe, ob der Nutzer die Ollama-Integration aktiviert hat
  const integration = await prisma.userIntegration.findFirst({
    where: {
      userId,
      provider: "ollama",
      enabled: true,
    },
  });

  if (!integration) {
    return null;
  }

  // Lade die globale Ollama-Konfiguration (BaseURL und Modell)
  const config = await prisma.integrationConfig.findUnique({
    where: { provider: "ollama" },
    select: { enabled: true, clientId: true, clientSecret: true },
  });

  if (!config?.enabled || !config.clientId) {
    return null;
  }

  const baseUrl = config.clientId;

  let model = "llama2";
  if (config.clientSecret) {
    try {
      const decrypted = decryptApiKey(config.clientSecret);
      model = decrypted || "llama2";
    } catch {
      model = "llama2";
    }
  }

  return new HttpOllamaClient({
    baseUrl,
    model,
  });
}

/**
 * Gibt den global konfigurierten Ollama-Client zurück (verwendet Admin-Konfiguration).
 * Wird beispielsweise für Hintergrund-Jobs und interne Funktionen verwendet, die
 * nicht an einen bestimmten Nutzer gebunden sind.
 */
export async function createGlobalOllamaClient(): Promise<OllamaClient | null> {
  const config = await prisma.integrationConfig.findUnique({
    where: { provider: "ollama" },
    select: { enabled: true, clientId: true, clientSecret: true },
  });

  if (!config?.enabled || !config.clientId) {
    return null;
  }

  const baseUrl = config.clientId;

  let model = "llama2";
  if (config.clientSecret) {
    try {
      const decrypted = decryptApiKey(config.clientSecret);
      model = decrypted || "llama2";
    } catch {
      model = "llama2";
    }
  }

  return new HttpOllamaClient({
    baseUrl,
    model,
  });
}
