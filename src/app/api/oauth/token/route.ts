import { handleToken } from "@/lib/mcp/oauthHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OAuth-Token-Endpunkt (authorization_code + PKCE, refresh_token). */
export async function POST(request: Request) {
  return handleToken(request);
}
