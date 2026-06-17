import { handleDisconnect } from "@/integrations/oauth/handlers";

/** DELETE /api/integrations/wahoo – trennt die Wahoo-Verbindung. */
export async function DELETE() {
  return handleDisconnect("wahoo");
}
