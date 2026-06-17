import { handleConnect } from "@/integrations/oauth/handlers";

/** GET /api/integrations/withings/connect – leitet zu Withings' OAuth-Consent weiter. */
export async function GET() {
  return handleConnect("withings");
}
