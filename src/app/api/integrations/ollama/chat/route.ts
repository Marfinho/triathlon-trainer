/**
 * Ollama Chat-Endpunkt.
 * Erlaubt authentifizierten Nutzern, mit Ollama zu kommunizieren, falls
 * ihre Integration aktiviert ist und die globale Ollama-Konfiguration vorhanden ist.
 */

import { auth } from "@/auth";
import { createOllamaClientForUser } from "@/integrations/ollama";

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { prompt, system } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return Response.json(
        { error: "Prompt required" },
        { status: 400 },
      );
    }

    const client = await createOllamaClientForUser(session.user.id);

    if (!client) {
      return Response.json(
        { error: "Ollama integration not available" },
        { status: 400 },
      );
    }

    const response = await client.generate({
      model: "", // uses default from client
      prompt,
      system: system ?? undefined,
      stream: false,
    });

    return Response.json({
      ok: true,
      response,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { ok: false, error: message },
      { status: 400 },
    );
  }
}
