import { handleConnect } from "@/integrations/oauth/handlers";

/** GET /api/integrations/strava/connect – leitet zu Stravas OAuth-Consent weiter. */
export async function GET() {
  return handleConnect("strava");
}
