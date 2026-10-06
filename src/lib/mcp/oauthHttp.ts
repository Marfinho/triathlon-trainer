import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import type { McpScope } from "./token";
import {
  OAuthError,
  baseUrl,
  buildRedirect,
  createAuthCode,
  exchangeCode,
  mcpResourceUrl,
  refreshTokens,
  registerClient,
  validateAuthorizeRequest,
  type AuthorizeParams,
} from "./oauth";

const MAX_BODY = 20_000;

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...NO_STORE, ...headers },
  });
}

function oauthError(e: unknown): Response {
  if (e instanceof OAuthError) {
    return json(e.status, { error: e.code, error_description: e.message });
  }
  console.error("OAuth request failed:", e);
  return json(500, { error: "server_error" });
}

/** Liest den Body begrenzt (Content-Length ist nur ein Hinweis, daher auch Textlänge prüfen). */
async function readBody(request: Request): Promise<string> {
  const len = Number(request.headers.get("content-length") ?? "0");
  if (len > MAX_BODY) throw new OAuthError("invalid_request", "Body zu groß.", 413);
  const text = await request.text();
  if (text.length > MAX_BODY) throw new OAuthError("invalid_request", "Body zu groß.", 413);
  return text;
}

// ---------------------------------------------------------------------------
// Metadaten (RFC 9728 / RFC 8414)
// ---------------------------------------------------------------------------

export function protectedResourceMetadata(request: Request): Response {
  const base = baseUrl(request);
  return json(
    200,
    {
      resource: mcpResourceUrl(base),
      authorization_servers: [base],
      bearer_methods_supported: ["header"],
      scopes_supported: ["read", "write_plan"],
    },
    { "Cache-Control": "public, max-age=300" },
  );
}

export function authorizationServerMetadata(request: Request): Response {
  const base = baseUrl(request);
  return json(
    200,
    {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["read", "write_plan"],
    },
    { "Cache-Control": "public, max-age=300" },
  );
}

// ---------------------------------------------------------------------------
// Dynamic Client Registration
// ---------------------------------------------------------------------------

export async function handleRegister(request: Request, deps: { db?: PrismaClient } = {}): Promise<Response> {
  const db = deps.db ?? defaultPrisma;
  try {
    const rl = await checkRateLimit(`oauth-register:${clientIp(request)}`, 20, 3_600_000, db);
    if (!rl.allowed) throw new OAuthError("temporarily_unavailable", "Zu viele Anfragen.", 429);

    let body: unknown;
    try {
      body = JSON.parse(await readBody(request));
    } catch (e) {
      if (e instanceof OAuthError) throw e;
      throw new OAuthError("invalid_client_metadata", "Kein gültiges JSON.");
    }
    const client = await registerClient(body, db);
    return json(201, {
      client_id: client.clientId,
      client_name: client.clientName,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
  } catch (e) {
    return oauthError(e);
  }
}

// ---------------------------------------------------------------------------
// Token-Endpunkt
// ---------------------------------------------------------------------------

export async function handleToken(request: Request, deps: { db?: PrismaClient } = {}): Promise<Response> {
  const db = deps.db ?? defaultPrisma;
  try {
    const rl = await checkRateLimit(`oauth-token:${clientIp(request)}`, 60, 60_000, db);
    if (!rl.allowed) throw new OAuthError("temporarily_unavailable", "Zu viele Anfragen.", 429);

    const form = new URLSearchParams(await readBody(request));
    const grant = form.get("grant_type");
    let tokens;
    if (grant === "authorization_code") {
      tokens = await exchangeCode(
        {
          code: form.get("code") ?? undefined,
          clientId: form.get("client_id") ?? undefined,
          redirectUri: form.get("redirect_uri") ?? undefined,
          codeVerifier: form.get("code_verifier") ?? undefined,
        },
        db,
      );
    } else if (grant === "refresh_token") {
      tokens = await refreshTokens(
        { refreshToken: form.get("refresh_token") ?? undefined, clientId: form.get("client_id") ?? undefined },
        db,
      );
    } else {
      throw new OAuthError("unsupported_grant_type", "grant_type nicht unterstützt.");
    }
    return json(200, tokens);
  } catch (e) {
    return oauthError(e);
  }
}

// ---------------------------------------------------------------------------
// Zustimmung (nur mit Session; aufgerufen von der Zustimmungsseite)
// ---------------------------------------------------------------------------

/**
 * Entscheidung des eingeloggten Nutzers. Prüft Origin (CSRF), validiert die
 * Anfrage erneut komplett (versteckte Formularfelder sind nicht vertrauenswürdig)
 * und liefert die Redirect-URL zurück, zu der der Browser navigiert.
 */
export async function handleConsent(
  request: Request,
  userId: string,
  deps: { db?: PrismaClient } = {},
): Promise<Response> {
  const db = deps.db ?? defaultPrisma;
  try {
    const base = baseUrl(request);
    if (request.headers.get("origin") !== base) throw new OAuthError("invalid_request", "Origin nicht erlaubt.", 403);
    if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
      throw new OAuthError("invalid_request", "Content-Type muss application/json sein.", 415);
    }
    const rl = await checkRateLimit(`oauth-consent:${userId}`, 30, 3_600_000, db);
    if (!rl.allowed) throw new OAuthError("temporarily_unavailable", "Zu viele Anfragen.", 429);

    let body: { params?: AuthorizeParams; decision?: string; grantWrite?: boolean };
    try {
      body = JSON.parse(await readBody(request));
    } catch (e) {
      if (e instanceof OAuthError) throw e;
      throw new OAuthError("invalid_request", "Kein gültiges JSON.");
    }
    const req = await validateAuthorizeRequest(body.params ?? {}, base, db);

    if (body.decision !== "allow") {
      await recordAudit({ userId, action: "oauth.consent_denied", ip: clientIp(request), meta: { clientId: req.client.clientId } }, db);
      return json(200, { redirectTo: buildRedirect(req.redirectUri, { error: "access_denied" }, req.state) });
    }

    const scopes: McpScope[] = body.grantWrite === true ? ["read", "write_plan"] : ["read"];
    const code = await createAuthCode(req, userId, scopes, db);
    await recordAudit(
      { userId, action: "oauth.consent_granted", ip: clientIp(request), meta: { clientId: req.client.clientId, clientName: req.client.clientName, scopes } },
      db,
    );
    return json(200, { redirectTo: buildRedirect(req.redirectUri, { code }, req.state) });
  } catch (e) {
    return oauthError(e);
  }
}
