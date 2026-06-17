import { handleDisconnect } from "@/integrations/oauth/handlers";

/** DELETE /api/integrations/strava – trennt die Strava-Verbindung. */
export async function DELETE() {
  return handleDisconnect("strava");
}
