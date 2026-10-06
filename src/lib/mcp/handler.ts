import type { PrismaClient } from "@prisma/client";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { prisma as defaultPrisma } from "@/lib/db";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { authenticateToken, bearerFromHeader } from "./token";
import { createMcpServer } from "./server";
import { baseUrl, protectedResourceMetadataUrl } from "./oauth";

/** Request-Obergrenze (Bytes) – ein Plan ist höchstens ~1 MB. */
export const MAX_BODY_BYTES = 2_000_000;
/** Alle Anfragen je IP und Minute. */
export const IP_LIMIT_PER_MINUTE = 300;
/** Fehlgeschlagene Authentifizierungen je IP und 15 Minuten. */
export const AUTH_FAIL_LIMIT = 10;
/** Anfragen je Token und Minute. */
export const TOKEN_LIMIT_PER_MINUTE = 120;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

function jsonRpcError(status: number, code: number, message: string, headers: Record<string, string> = {}) {
  return json(status, { jsonrpc: "2.0", error: { code, message }, id: null }, headers);
}

/** Erlaubte Browser-Origins (DNS-Rebinding-/CSRF-Schutz). Server-zu-Server sendet keine. */
function allowedOrigins(): string[] {
  return (process.env.MCP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Zustandsloser Streamable-HTTP-MCP-Endpunkt (nur POST, JSON-Antworten).
 * Authentifizierung ausschließlich per `Authorization: Bearer lhm_…`.
 */
export async function handleMcpRequest(
  request: Request,
  deps: { db?: PrismaClient } = {},
): Promise<Response> {
  const db = deps.db ?? defaultPrisma;

  if (request.method !== "POST") {
    return jsonRpcError(405, -32000, "Method not allowed.", { Allow: "POST" });
  }

  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins().includes(origin)) {
    return jsonRpcError(403, -32000, "Origin not allowed.");
  }

  const ip = clientIp(request);
  const ipLimit = await checkRateLimit(`mcp-ip:${ip}`, IP_LIMIT_PER_MINUTE, 60_000, db);
  if (!ipLimit.allowed) {
    return jsonRpcError(429, -32000, "Too many requests.", {
      "Retry-After": String(Math.ceil(ipLimit.retryAfterMs / 1000)),
    });
  }

  const token = bearerFromHeader(request.headers.get("authorization"));
  const principal = token ? await authenticateToken(token, db) : null;
  if (!principal) {
    const fails = await checkRateLimit(`mcp-authfail:${ip}`, AUTH_FAIL_LIMIT, 15 * 60_000, db);
    if (!fails.allowed) {
      return jsonRpcError(429, -32000, "Too many failed attempts.", {
        "Retry-After": String(Math.ceil(fails.retryAfterMs / 1000)),
      });
    }
    return jsonRpcError(401, -32001, "Unauthorized.", {
      "WWW-Authenticate": `Bearer realm="localhub-mcp", resource_metadata="${protectedResourceMetadataUrl(baseUrl(request))}"`,
    });
  }

  const tokenLimit = await checkRateLimit(`mcp-token:${principal.tokenId}`, TOKEN_LIMIT_PER_MINUTE, 60_000, db);
  if (!tokenLimit.allowed) {
    return jsonRpcError(429, -32000, "Too many requests.", {
      "Retry-After": String(Math.ceil(tokenLimit.retryAfterMs / 1000)),
    });
  }

  const server = createMcpServer(principal, db);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_BODY_BYTES,
  });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  } catch (e) {
    console.error("MCP request failed:", e);
    return jsonRpcError(500, -32603, "Internal error.");
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}
