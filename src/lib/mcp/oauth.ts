import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { TOKEN_PREFIX, hashToken, MCP_SCOPES, type McpScope } from "./token";

/**
 * Minimaler OAuth-2.1-Autorisierungsserver für den MCP-Connector (claude.ai):
 *  - Dynamic Client Registration (RFC 7591), nur öffentliche Clients
 *  - Authorization-Code-Flow mit PKCE (S256, Pflicht)
 *  - kurzlebige Access-Token (1 h) + rotierende Refresh-Token (90 Tage) mit
 *    Wiederverwendungs-Erkennung
 *
 * Access-Token sind normale `McpToken`-Zeilen (gleiche Prüfung wie CLI-Token).
 * Der Nutzer entscheidet auf der Zustimmungsseite selbst über den Scope.
 */

export const ACCESS_TTL_SECONDS = 3600;
export const REFRESH_TTL_DAYS = 90;
export const CODE_TTL_SECONDS = 300;
export const MAX_CLIENTS = 1000;
export const REFRESH_PREFIX = "lhr_";
const CODE_PREFIX = "lhc_";

export class OAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Öffentliche Basis-URL
// ---------------------------------------------------------------------------

/**
 * Basis-URL der App für Issuer/Metadaten. Bevorzugt NEXTAUTH_URL (vom Betreiber
 * gesetzt, nicht per Host-Header manipulierbar); nur ohne diese Variable (lokale
 * Entwicklung) wird der Origin der Anfrage verwendet.
 */
export function baseUrl(request: Request): string {
  const env = process.env.NEXTAUTH_URL?.trim();
  if (env) {
    try {
      return new URL(env).origin;
    } catch {
      // fällt auf Request-Origin zurück
    }
  }
  return new URL(request.url).origin;
}

export const mcpResourceUrl = (base: string) => `${base}/api/mcp`;
export const protectedResourceMetadataUrl = (base: string) =>
  `${base}/.well-known/oauth-protected-resource/api/mcp`;

// ---------------------------------------------------------------------------
// Redirect-URI-Richtlinie
// ---------------------------------------------------------------------------

const DEFAULT_REDIRECT_HOSTS = ["claude.ai", "claude.com"];
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

function allowedRedirectHosts(): string[] {
  const extra = (process.env.MCP_OAUTH_REDIRECT_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...DEFAULT_REDIRECT_HOSTS, ...extra];
}

/**
 * Erlaubt: https-Callbacks der Claude-Hosts (erweiterbar per Env) sowie
 * Loopback-http (Claude Code CLI). Keine Credentials/Fragmente. Das verhindert,
 * dass ein per Registrierung eingeschleuster Client Codes an fremde Hosts leitet.
 */
export function isAllowedRedirectUri(uri: unknown): uri is string {
  if (typeof uri !== "string" || uri.length > 2048) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.username || u.password || u.hash) return false;
  if (u.protocol === "https:") return allowedRedirectHosts().includes(u.hostname.toLowerCase());
  if (u.protocol === "http:") return LOOPBACK_HOSTS.includes(u.hostname.toLowerCase());
  return false;
}

// ---------------------------------------------------------------------------
// Dynamic Client Registration
// ---------------------------------------------------------------------------

export interface RegisteredClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: Date;
}

function cleanName(value: unknown): string {
  if (typeof value !== "string") return "MCP-Client";
  // Steuerzeichen entfernen, Länge begrenzen (Anzeige erfolgt escaped).
  const name = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100);
  return name || "MCP-Client";
}

export async function registerClient(
  body: unknown,
  db: PrismaClient = defaultPrisma,
): Promise<RegisteredClient> {
  if (!body || typeof body !== "object") {
    throw new OAuthError("invalid_client_metadata", "Body muss ein JSON-Objekt sein.");
  }
  const b = body as Record<string, unknown>;

  const uris = b.redirect_uris;
  if (!Array.isArray(uris) || uris.length < 1 || uris.length > 5) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uris: 1 bis 5 Einträge erforderlich.");
  }
  if (!uris.every(isAllowedRedirectUri)) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uri nicht erlaubt.");
  }
  if (b.token_endpoint_auth_method !== undefined && b.token_endpoint_auth_method !== "none") {
    throw new OAuthError("invalid_client_metadata", "Nur token_endpoint_auth_method=none (PKCE) wird unterstützt.");
  }
  const okGrants = ["authorization_code", "refresh_token"];
  if (b.grant_types !== undefined && !(Array.isArray(b.grant_types) && b.grant_types.every((g) => okGrants.includes(g)))) {
    throw new OAuthError("invalid_client_metadata", "grant_types nicht unterstützt.");
  }
  if (b.response_types !== undefined && !(Array.isArray(b.response_types) && b.response_types.every((r) => r === "code"))) {
    throw new OAuthError("invalid_client_metadata", "response_types nicht unterstützt.");
  }

  // Unbenutzte, alte Registrierungen aufräumen; harte Obergrenze gegen Tabellen-Spam.
  const used = (
    await db.mcpToken.findMany({
      where: { clientId: { not: null } },
      distinct: ["clientId"],
      select: { clientId: true },
    })
  ).map((t) => t.clientId as string);
  await db.oAuthClient.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 86_400_000) }, clientId: { notIn: used } },
  });
  if ((await db.oAuthClient.count()) >= MAX_CLIENTS) {
    throw new OAuthError("temporarily_unavailable", "Registrierung vorübergehend nicht möglich.", 503);
  }

  const redirectUris = [...new Set(uris as string[])];
  const row = await db.oAuthClient.create({
    data: { clientId: `lhc_${randomUUID()}`, clientName: cleanName(b.client_name), redirectUris },
  });
  return { clientId: row.clientId, clientName: row.clientName, redirectUris, createdAt: row.createdAt };
}

// ---------------------------------------------------------------------------
// Autorisierungsanfrage
// ---------------------------------------------------------------------------

const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;

export interface AuthorizeParams {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  resource?: string;
  scope?: string;
}

export interface ValidAuthorizeRequest {
  client: { clientId: string; clientName: string };
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
}

/** Validiert eine Autorisierungsanfrage vollständig. Wirft OAuthError (nie weiterleiten!). */
export async function validateAuthorizeRequest(
  p: AuthorizeParams,
  base: string,
  db: PrismaClient = defaultPrisma,
): Promise<ValidAuthorizeRequest> {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  if (str(p.response_type) !== "code") throw new OAuthError("unsupported_response_type", "response_type muss 'code' sein.");

  const clientId = str(p.client_id);
  const client = clientId && clientId.length < 100 ? await db.oAuthClient.findUnique({ where: { clientId } }) : null;
  if (!client) throw new OAuthError("invalid_client", "Unbekannter Client.");

  const redirectUri = str(p.redirect_uri);
  const registered = Array.isArray(client.redirectUris) ? (client.redirectUris as unknown[]) : [];
  if (!redirectUri || !registered.includes(redirectUri) || !isAllowedRedirectUri(redirectUri)) {
    throw new OAuthError("invalid_request", "redirect_uri stimmt nicht mit der Registrierung überein.");
  }

  if (str(p.code_challenge_method) !== "S256") throw new OAuthError("invalid_request", "PKCE mit S256 ist Pflicht.");
  const challenge = str(p.code_challenge);
  if (!CHALLENGE_RE.test(challenge)) throw new OAuthError("invalid_request", "code_challenge ungültig.");

  const resource = str(p.resource);
  if (resource) {
    const want = mcpResourceUrl(base);
    if (resource.replace(/\/$/, "") !== want) throw new OAuthError("invalid_target", "Unbekannte resource.");
  }

  const state = str(p.state);
  if (state.length > 512) throw new OAuthError("invalid_request", "state zu lang.");

  return {
    client: { clientId: client.clientId, clientName: client.clientName },
    redirectUri,
    codeChallenge: challenge,
    state: state || null,
  };
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Erzeugt einen einmal einlösbaren Code (nur der Hash wird gespeichert). */
export async function createAuthCode(
  req: ValidAuthorizeRequest,
  userId: string,
  scopes: McpScope[],
  db: PrismaClient = defaultPrisma,
): Promise<string> {
  const code = CODE_PREFIX + randomBytes(32).toString("base64url");
  await db.oAuthCode.create({
    data: {
      codeHash: sha256Hex(code),
      clientId: req.client.clientId,
      userId,
      redirectUri: req.redirectUri,
      codeChallenge: req.codeChallenge,
      scopes,
      expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000),
    },
  });
  return code;
}

/** Bildet die Redirect-URL zurück zum Client (Code oder Fehler). */
export function buildRedirect(
  redirectUri: string,
  params: Record<string, string>,
  state: string | null,
): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (state) u.searchParams.set("state", state);
  return u.toString();
}

// ---------------------------------------------------------------------------
// Token-Ausgabe
// ---------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

function toScopes(raw: unknown): McpScope[] {
  const set = new Set<McpScope>(["read"]);
  if (Array.isArray(raw)) for (const s of raw) if ((MCP_SCOPES as readonly unknown[]).includes(s)) set.add(s as McpScope);
  return [...set];
}

async function issueTokens(
  db: PrismaClient,
  opts: { userId: string; clientId: string; clientName: string; scopes: McpScope[] },
): Promise<TokenResponse> {
  const access = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const refresh = REFRESH_PREFIX + randomBytes(32).toString("base64url");
  await db.mcpToken.create({
    data: {
      userId: opts.userId,
      name: `OAuth: ${opts.clientName}`.slice(0, 80),
      tokenHash: hashToken(access),
      prefix: `${access.slice(0, TOKEN_PREFIX.length + 4)}…`,
      scopes: opts.scopes,
      expiresAt: new Date(Date.now() + ACCESS_TTL_SECONDS * 1000),
      clientId: opts.clientId,
      refreshHash: sha256Hex(refresh),
      refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
    },
  });
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: refresh,
    scope: opts.scopes.join(" "),
  };
}

/** Widerruft alle OAuth-Token eines Clients für einen Nutzer (Replay-Reaktion). */
async function revokeFamily(db: PrismaClient, userId: string, clientId: string) {
  await db.mcpToken.updateMany({ where: { userId, clientId, revokedAt: null }, data: { revokedAt: new Date() } });
}

async function clientName(db: PrismaClient, clientId: string): Promise<string> {
  const c = await db.oAuthClient.findUnique({ where: { clientId }, select: { clientName: true } });
  return c?.clientName ?? "MCP-Client";
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** authorization_code → Token. Der Code wird atomar verbraucht (auch bei falschem Verifier). */
export async function exchangeCode(
  p: { code?: string; clientId?: string; redirectUri?: string; codeVerifier?: string },
  db: PrismaClient = defaultPrisma,
): Promise<TokenResponse> {
  const invalid = () => new OAuthError("invalid_grant", "Code ungültig, abgelaufen oder bereits verwendet.");
  if (!p.code || !p.clientId || !p.redirectUri || !p.codeVerifier) {
    throw new OAuthError("invalid_request", "code, client_id, redirect_uri und code_verifier sind Pflicht.");
  }
  if (p.code.length > 200) throw invalid();

  const row = await db.oAuthCode.findUnique({ where: { codeHash: sha256Hex(p.code) } });
  if (!row) throw invalid();

  const claimed = await db.oAuthCode.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) {
    // Wiederverwendeter Code: bereits ausgestellte Token dieses Clients widerrufen.
    if (row.usedAt) await revokeFamily(db, row.userId, row.clientId);
    throw invalid();
  }

  if (row.clientId !== p.clientId || row.redirectUri !== p.redirectUri) throw invalid();
  if (!VERIFIER_RE.test(p.codeVerifier)) throw invalid();
  const challenge = createHash("sha256").update(p.codeVerifier).digest("base64url");
  if (!safeEqual(challenge, row.codeChallenge)) throw invalid();

  return issueTokens(db, {
    userId: row.userId,
    clientId: row.clientId,
    clientName: await clientName(db, row.clientId),
    scopes: toScopes(row.scopes),
  });
}

/** refresh_token → neues Token-Paar (Rotation; Wiederverwendung widerruft alles). */
export async function refreshTokens(
  p: { refreshToken?: string; clientId?: string },
  db: PrismaClient = defaultPrisma,
): Promise<TokenResponse> {
  const invalid = () => new OAuthError("invalid_grant", "Refresh-Token ungültig oder abgelaufen.");
  if (!p.refreshToken || !p.clientId) throw new OAuthError("invalid_request", "refresh_token und client_id sind Pflicht.");
  if (p.refreshToken.length > 200 || !p.refreshToken.startsWith(REFRESH_PREFIX)) throw invalid();

  const row = await db.mcpToken.findUnique({ where: { refreshHash: sha256Hex(p.refreshToken) } });
  if (!row || row.clientId !== p.clientId) throw invalid();

  if (row.revokedAt) {
    // Bereits rotiert oder widerrufen: Wiederverwendung → gesamte Familie sperren.
    await revokeFamily(db, row.userId, row.clientId!);
    throw invalid();
  }
  if (!row.refreshExpiresAt || row.refreshExpiresAt.getTime() <= Date.now()) throw invalid();

  const rotated = await db.mcpToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (rotated.count !== 1) {
    await revokeFamily(db, row.userId, row.clientId!);
    throw invalid();
  }
  return issueTokens(db, {
    userId: row.userId,
    clientId: row.clientId!,
    clientName: await clientName(db, row.clientId!),
    scopes: toScopes(row.scopes),
  });
}
