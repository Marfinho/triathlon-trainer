/**
 * Test-Endpunkt für Ollama-Konfiguration mit detaillierten Fehlermeldungen.
 * Admin kann damit prüfen, ob die Verbindung zur Ollama-Instanz funktioniert
 * und welche Modelle verfügbar sind.
 */

import { auth } from "@/auth";
import { createGlobalOllamaClient } from "@/integrations/ollama/userClient";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await auth();

  // Nur Admin darf Ollama-Einstellungen testen
  if (!session?.user?.id || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // Lade aktuelle Config aus DB
    const config = await prisma.integrationConfig.findUnique({
      where: { provider: "ollama" },
      select: { enabled: true, clientId: true },
    });

    if (!config?.enabled) {
      return Response.json(
        {
          ok: false,
          error: "Ollama ist nicht aktiviert",
          hint: "Bitte aktiviere die Ollama-Integration zuerst",
        },
        { status: 400 },
      );
    }

    if (!config.clientId) {
      return Response.json(
        {
          ok: false,
          error: "Basis-URL nicht gesetzt",
          hint: "Gib eine Basis-URL ein, z.B. http://localhost:11434",
        },
        { status: 400 },
      );
    }

    const baseUrl = config.clientId;

    // Validiere URL Format
    try {
      new URL(baseUrl);
    } catch {
      return Response.json(
        {
          ok: false,
          error: "Ungültiges URL-Format",
          hint: `"${baseUrl}" ist keine gültige URL. Format: http://hostname:port`,
        },
        { status: 400 },
      );
    }

    // Teste Verbindung mit Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return Response.json(
            {
              ok: false,
              error: "Ollama API nicht gefunden",
              hint: `Ist Ollama wirklich unter "${baseUrl}" erreichbar? Prüfe auch den Port.`,
            },
            { status: 400 },
          );
        }

        if (response.status === 401) {
          return Response.json(
            {
              ok: false,
              error: "Authentifizierung fehlgeschlagen",
              hint: "Ollama benötigt möglicherweise API-Key-Authentifizierung",
            },
            { status: 400 },
          );
        }

        return Response.json(
          {
            ok: false,
            error: `Ollama antwortet mit Fehler ${response.status}`,
            hint: "Überprüfe deine Ollama-Instanz und die Logs",
          },
          { status: 400 },
        );
      }

      const data = (await response.json()) as { models: Array<{ name: string }> };

      if (!data.models || data.models.length === 0) {
        return Response.json(
          {
            ok: false,
            error: "Keine Modelle verfügbar",
            hint: "Lade erst ein Modell in Ollama, z.B. mit: ollama pull llama2",
          },
          { status: 400 },
        );
      }

      const models = data.models.map((m) => m.name);

      return Response.json({
        ok: true,
        models,
        message: `✓ Verbunden. ${models.length} Modell(e) verfügbar: ${models.join(", ")}`,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return Response.json(
          {
            ok: false,
            error: "Verbindungs-Timeout (5 Sekunden)",
            hint: `Ollama unter "${baseUrl}" antwortet nicht. Ist Ollama gestartet? Prüfe: curl ${baseUrl}/api/tags`,
          },
          { status: 400 },
        );
      }

      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);

      if (errorMsg.includes("ECONNREFUSED")) {
        return Response.json(
          {
            ok: false,
            error: "Verbindung abgelehnt",
            hint: `Ollama läuft nicht unter "${baseUrl}". Starte Ollama oder überprüfe die Basis-URL.`,
          },
          { status: 400 },
        );
      }

      if (errorMsg.includes("ENOTFOUND") || errorMsg.includes("getaddrinfo")) {
        return Response.json(
          {
            ok: false,
            error: "Host nicht erreichbar",
            hint: `"${baseUrl}" kann nicht aufgelöst werden. Überprüfe Schreibweise und Netzwerk.`,
          },
          { status: 400 },
        );
      }

      if (errorMsg.includes("ETIMEDOUT")) {
        return Response.json(
          {
            ok: false,
            error: "Netzwerk-Timeout",
            hint: `${baseUrl} ist nicht erreichbar. Prüfe Firewall, Netzwerk und ob Ollama läuft.`,
          },
          { status: 400 },
        );
      }

      return Response.json(
        {
          ok: false,
          error: `Verbindungsfehler: ${errorMsg}`,
          hint: "Starte Ollama lokal oder gib die korrekte Remote-URL ein",
        },
        { status: 400 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      {
        ok: false,
        error: `Fehler: ${message}`,
        hint: "Überprüfe deine Ollama-Konfiguration und Logs",
      },
      { status: 400 },
    );
  }
}

