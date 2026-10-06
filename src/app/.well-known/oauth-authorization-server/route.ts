import { authorizationServerMetadata } from "@/lib/mcp/oauthHttp";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return authorizationServerMetadata(request);
}
