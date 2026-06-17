import { handleConnect } from "@/integrations/oauth/handlers";

/** GET /api/integrations/wahoo/connect – leitet zu Wahoos OAuth-Consent weiter. */
export async function GET() {
  return handleConnect("wahoo");
}
