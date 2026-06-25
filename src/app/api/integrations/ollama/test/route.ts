/**
 * Test-Endpunkt für Ollama-Konfiguration.
 * Admin kann damit prüfen, ob die Verbindung zur Ollama-Instanz funktioniert
 * und welche Modelle verfügbar sind.
 */

import { auth } from "@/auth";
import { createGlobalOllamaClient } from "@/integrations/ollama/userClient";

export async function POST() {
  const session = await auth();

  // Nur Admin darf Ollama-Einstellungen testen
  if (!session?.user?.id || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const client = await createGlobalOllamaClient();

    if (!client) {
      return Response.json(
        { error: "Ollama integration not configured" },
        { status: 400 },
      );
    }

    // Versuche, verfügbare Modelle zu laden (prüft Verbindung)
    const models = await client.listModels();

    return Response.json({
      ok: true,
      models,
      message: `Connected to Ollama. ${models.length} model(s) available.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { ok: false, error: message },
      { status: 400 },
    );
  }
}
