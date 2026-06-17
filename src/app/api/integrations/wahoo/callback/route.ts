import { handleCallback } from "@/integrations/oauth/handlers";

/** GET /api/integrations/wahoo/callback – OAuth-Redirect-Ziel von Wahoo. */
export async function GET(request: Request) {
  return handleCallback("wahoo", request);
}
