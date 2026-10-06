import { handleMcpRequest } from "@/lib/mcp/handler";

// Prisma + node:crypto → Node-Runtime; keine Caches für Nutzerdaten.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Remote-MCP-Endpunkt (Streamable HTTP, zustandslos). Eigene Token-Auth
 * (Bearer lhm_…) statt Session-Cookie – siehe src/lib/mcp/handler.ts.
 */
export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}
