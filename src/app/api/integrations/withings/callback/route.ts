import { handleCallback } from "@/integrations/oauth/handlers";

/** GET /api/integrations/withings/callback – OAuth-Redirect-Ziel von Withings. */
export async function GET(request: Request) {
  return handleCallback("withings", request);
}
