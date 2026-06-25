/**
 * Check if Ollama is configured via the admin panel (database).
 * Server-side only.
 */

import { prisma } from "@/lib/db";

export async function isOllamaConfigured(): Promise<boolean> {
  try {
    const config = await prisma.integrationConfig.findUnique({
      where: { provider: "ollama" },
      select: { enabled: true, clientId: true },
    });

    return config?.enabled === true && Boolean(config.clientId);
  } catch {
    return false;
  }
}
