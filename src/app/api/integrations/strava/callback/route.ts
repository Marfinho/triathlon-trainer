import { handleCallback } from "@/integrations/oauth/handlers";

/** GET /api/integrations/strava/callback – OAuth-Redirect-Ziel von Strava. */
export async function GET(request: Request) {
  return handleCallback("strava", request);
}
