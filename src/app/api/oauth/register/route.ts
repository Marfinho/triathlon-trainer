import { handleRegister } from "@/lib/mcp/oauthHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dynamic Client Registration (RFC 7591) für den MCP-Connector. */
export async function POST(request: Request) {
  return handleRegister(request);
}
