import { handleDisconnect } from "@/integrations/oauth/handlers";

/** DELETE /api/integrations/withings – trennt die Withings-Verbindung. */
export async function DELETE() {
  return handleDisconnect("withings");
}
