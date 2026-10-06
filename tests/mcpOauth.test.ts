import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";
import {
  authorizationServerMetadata,
  handleConsent,
  handleRegister,
  handleToken,
  protectedResourceMetadata,
} from "@/lib/mcp/oauthHttp";
import { isAllowedRedirectUri, baseUrl } from "@/lib/mcp/oauth";
import { handleMcpRequest } from "@/lib/mcp/handler";
import { safeCallbackPath } from "@/lib/safe-callback";

let db: PrismaClient;
let cleanup: () => Promise<void>;
let userId: string;

const BASE = "https://trainer.example.com";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const savedEnv = process.env.NEXTAUTH_URL;

beforeAll(() => {
  const ctx = createTestDb();
  db = ctx.db;
  cleanup = ctx.cleanup;
});
afterAll(async () => {
  await cleanup();
});
beforeEach(async () => {
  process.env.NEXTAUTH_URL = BASE;
  userId = await resetDb(db);
  await db.rateLimitEntry.deleteMany();
  await db.oAuthClient.deleteMany();
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = savedEnv;
});

const pkce = () => {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
};

const post = (path: string, body: string, headers: Record<string, string> = {}) =>
  new Request(`${BASE}${path}`, { method: "POST", body, headers: { "x-forwarded-for": "198.51.100.7", ...headers } });

async function register(redirectUris = [REDIRECT], name = "Claude") {
  const res = await handleRegister(
    post("/api/oauth/register", JSON.stringify({ client_name: name, redirect_uris: redirectUris }), { "content-type": "application/json" }),
    { db },
  );
  return { res, body: await res.json() };
}

function consent(params: Record<string, string>, opts: { decision?: string; grantWrite?: boolean; origin?: string | null; ctype?: string } = {}) {
  const headers: Record<string, string> = { "content-type": opts.ctype ?? "application/json" };
  if (opts.origin !== null) headers.origin = opts.origin ?? BASE;
  return handleConsent(
    post("/api/oauth/consent", JSON.stringify({ params, decision: opts.decision ?? "allow", grantWrite: opts.grantWrite }), headers),
    userId,
    { db },
  );
}

function authParams(clientId: string, challenge: string, extra: Record<string, string> = {}) {
  return {
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "st-123",
    resource: `${BASE}/api/mcp`,
    ...extra,
  };
}

async function getCode(clientId: string, challenge: string, opts: { grantWrite?: boolean } = {}) {
  const res = await consent(authParams(clientId, challenge), opts);
  expect(res.status).toBe(200);
  const { redirectTo } = await res.json();
  const u = new URL(redirectTo);
  expect(u.searchParams.get("state")).toBe("st-123");
  return u.searchParams.get("code")!;
}

const tokenReq = (fields: Record<string, string>) =>
  handleToken(post("/api/oauth/token", new URLSearchParams(fields).toString(), { "content-type": "application/x-www-form-urlencoded" }), { db });

async function fullFlow(opts: { grantWrite?: boolean } = {}) {
  const { body: client } = await register();
  const { verifier, challenge } = pkce();
  const code = await getCode(client.client_id, challenge, opts);
  const res = await tokenReq({ grant_type: "authorization_code", code, client_id: client.client_id, redirect_uri: REDIRECT, code_verifier: verifier });
  return { client, verifier, challenge, code, res, tokens: await res.clone().json() };
}

const mcpCall = (token: string, method = "tools/list") =>
  handleMcpRequest(
    new Request(`${BASE}/api/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: {} }),
    }),
    { db },
  );

describe("Redirect-URI-Richtlinie", () => {
  it.each([
    [REDIRECT, true],
    ["https://claude.com/api/mcp/auth_callback", true],
    ["http://localhost:8123/callback", true],
    ["http://127.0.0.1:8123/cb", true],
    ["http://[::1]:8123/cb", true],
    ["https://evil.example/cb", false],
    ["https://claude.ai.evil.example/cb", false],
    ["https://evil.example/@claude.ai/cb", false],
    ["https://user:pw@claude.ai/cb", false],
    ["https://claude.ai/cb#frag", false],
    ["http://claude.ai/cb", false],
    ["http://localhost.evil.example/cb", false],
    ["javascript:alert(1)", false],
    ["//claude.ai/cb", false],
    ["claude.ai/cb", false],
    ["", false],
  ])("%s → %s", (uri, expected) => {
    expect(isAllowedRedirectUri(uri)).toBe(expected);
  });
  it("lehnt Nicht-Strings ab", () => {
    expect(isAllowedRedirectUri(null)).toBe(false);
    expect(isAllowedRedirectUri(["https://claude.ai/x"])).toBe(false);
  });
});

describe("Metadaten", () => {
  it("liefert Protected-Resource- und Authorization-Server-Metadaten mit fester Basis-URL", async () => {
    const forged = new Request("http://attacker.example/.well-known/oauth-authorization-server", { headers: { host: "attacker.example" } });
    const as = await authorizationServerMetadata(forged).json();
    expect(as.issuer).toBe(BASE);
    expect(as.authorization_endpoint).toBe(`${BASE}/oauth/authorize`);
    expect(as.token_endpoint).toBe(`${BASE}/api/oauth/token`);
    expect(as.registration_endpoint).toBe(`${BASE}/api/oauth/register`);
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    expect(as.token_endpoint_auth_methods_supported).toEqual(["none"]);
    const pr = await protectedResourceMetadata(forged).json();
    expect(pr.resource).toBe(`${BASE}/api/mcp`);
    expect(pr.authorization_servers).toEqual([BASE]);
  });
  it("fällt ohne NEXTAUTH_URL auf den Request-Origin zurück", () => {
    delete process.env.NEXTAUTH_URL;
    expect(baseUrl(new Request("http://localhost:3000/x"))).toBe("http://localhost:3000");
  });
  it("401 des MCP-Endpunkts verweist auf die Resource-Metadaten", async () => {
    const res = await mcpCall("lhm_ungueltig");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain(`resource_metadata="${BASE}/.well-known/oauth-protected-resource/api/mcp"`);
  });
});

describe("Dynamic Client Registration", () => {
  it("registriert einen öffentlichen Client", async () => {
    const { res, body } = await register();
    expect(res.status).toBe(201);
    expect(body.client_id).toMatch(/^lhc_/);
    expect(body.token_endpoint_auth_method).toBe("none");
    expect(body.client_secret).toBeUndefined();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("lehnt fremde Redirect-URIs, Secrets-Methoden und kaputte Bodies ab", async () => {
    expect((await register(["https://evil.example/cb"])).res.status).toBe(400);
    expect((await register([])).res.status).toBe(400);
    expect((await register(Array(6).fill(REDIRECT))).res.status).toBe(400);
    const basic = await handleRegister(
      post("/api/oauth/register", JSON.stringify({ redirect_uris: [REDIRECT], token_endpoint_auth_method: "client_secret_basic" }), { "content-type": "application/json" }),
      { db },
    );
    expect(basic.status).toBe(400);
    const junk = await handleRegister(post("/api/oauth/register", "{kaputt", {}), { db });
    expect(junk.status).toBe(400);
    const big = await handleRegister(post("/api/oauth/register", "x".repeat(30_000), {}), { db });
    expect(big.status).toBe(413);
  });
  it("bereinigt Steuerzeichen im Client-Namen", async () => {
    const { body } = await register([REDIRECT], "Evil\u0000\n<b>Name</b>");
    expect(body.client_name).toBe("Evil<b>Name</b>");
  });
  it("räumt unbenutzte alte Registrierungen auf", async () => {
    const { body } = await register();
    await db.oAuthClient.update({ where: { clientId: body.client_id }, data: { createdAt: new Date(Date.now() - 2 * 86_400_000) } });
    await register();
    expect(await db.oAuthClient.findUnique({ where: { clientId: body.client_id } })).toBeNull();
  });
});

describe("Autorisierung & Zustimmung", () => {
  it("verlangt Same-Origin und JSON (CSRF-Schutz)", async () => {
    const { body: c } = await register();
    const { challenge } = pkce();
    const p = authParams(c.client_id, challenge);
    expect((await consent(p, { origin: "https://evil.example" })).status).toBe(403);
    expect((await consent(p, { origin: null })).status).toBe(403);
    expect((await consent(p, { ctype: "text/plain" })).status).toBe(415);
    expect(await db.oAuthCode.count()).toBe(0);
  });

  it.each([
    ["response_type", { response_type: "token" }],
    ["unbekannter Client", { client_id: "lhc_nope" }],
    ["fremde redirect_uri", { redirect_uri: "https://evil.example/cb" }],
    ["andere registrierte-URI-Variante", { redirect_uri: `${REDIRECT}?x=1` }],
    ["PKCE fehlt", { code_challenge: "" }],
    ["PKCE plain", { code_challenge_method: "plain" }],
    ["zu kurze Challenge", { code_challenge: "abc" }],
    ["fremde resource", { resource: "https://evil.example/api/mcp" }],
    ["state zu lang", { state: "s".repeat(600) }],
  ])("lehnt ungültige Anfrage ab: %s", async (_name, override) => {
    const { body: c } = await register();
    const { challenge } = pkce();
    const res = await consent(authParams(c.client_id, challenge, override as Record<string, string>));
    expect(res.status).toBeGreaterThanOrEqual(400);
    const j = await res.json();
    expect(j.redirectTo).toBeUndefined();
    expect(await db.oAuthCode.count()).toBe(0);
  });

  it("Ablehnen leitet mit access_denied und state zurück, ohne Code", async () => {
    const { body: c } = await register();
    const res = await consent(authParams(c.client_id, pkce().challenge), { decision: "deny" });
    const u = new URL((await res.json()).redirectTo);
    expect(u.origin + u.pathname).toBe(REDIRECT);
    expect(u.searchParams.get("error")).toBe("access_denied");
    expect(u.searchParams.get("state")).toBe("st-123");
    expect(u.searchParams.get("code")).toBeNull();
    expect(await db.oAuthCode.count()).toBe(0);
  });

  it("speichert nur den Hash des Codes und protokolliert die Zustimmung", async () => {
    const { body: c } = await register();
    const code = await getCode(c.client_id, pkce().challenge);
    const row = await db.oAuthCode.findFirstOrThrow();
    expect(JSON.stringify(row)).not.toContain(code);
    expect(row.userId).toBe(userId);
    const audit = await db.auditLog.findFirst({ where: { action: "oauth.consent_granted" } });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit)).not.toContain(code);
  });

  it("bewahrt Query-Parameter der redirect_uri und escaped state", async () => {
    const { body: c } = await register(["http://localhost:9999/cb?keep=1"]);
    const res = await consent({ ...authParams(c.client_id, pkce().challenge, { redirect_uri: "http://localhost:9999/cb?keep=1", state: "a&b=c d" }) });
    const u = new URL((await res.json()).redirectTo);
    expect(u.searchParams.get("keep")).toBe("1");
    expect(u.searchParams.get("state")).toBe("a&b=c d");
    expect(u.searchParams.getAll("code")).toHaveLength(1);
  });
});

describe("Token-Endpunkt", () => {
  it("tauscht Code + PKCE gegen Token; Access-Token funktioniert am MCP-Endpunkt (nur read)", async () => {
    const { res, tokens } = await fullFlow();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(tokens.token_type).toBe("Bearer");
    expect(tokens.expires_in).toBe(3600);
    expect(tokens.scope).toBe("read");
    expect(tokens.access_token).toMatch(/^lhm_/);
    expect(tokens.refresh_token).toMatch(/^lhr_/);

    const list = await (await mcpCall(tokens.access_token)).json();
    const names = list.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("get_overview");
    expect(names).not.toContain("apply_plan");

    const rows = await db.mcpToken.findMany({ where: { userId } });
    expect(JSON.stringify(rows)).not.toContain(tokens.access_token);
    expect(JSON.stringify(rows)).not.toContain(tokens.refresh_token);
  });

  it("vergibt write_plan nur, wenn der Nutzer es ausdrücklich erlaubt", async () => {
    const { tokens } = await fullFlow({ grantWrite: true });
    expect(tokens.scope).toBe("read write_plan");
    const names = (await (await mcpCall(tokens.access_token)).json()).result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("apply_plan");
  });

  it("verbraucht den Code auch bei falschem Verifier (kein Raten)", async () => {
    const { body: c } = await register();
    const { verifier, challenge } = pkce();
    const code = await getCode(c.client_id, challenge);
    const base = { grant_type: "authorization_code", code, client_id: c.client_id, redirect_uri: REDIRECT };
    const bad = await tokenReq({ ...base, code_verifier: pkce().verifier });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("invalid_grant");
    const retry = await tokenReq({ ...base, code_verifier: verifier });
    expect(retry.status).toBe(400);
  });

  it.each([
    ["falscher client_id", (f: Record<string, string>) => ({ ...f, client_id: "lhc_other" })],
    ["falsche redirect_uri", (f: Record<string, string>) => ({ ...f, redirect_uri: "https://claude.com/api/mcp/auth_callback" })],
    ["fehlender Verifier", (f: Record<string, string>) => ({ ...f, code_verifier: "" })],
    ["zu kurzer Verifier", (f: Record<string, string>) => ({ ...f, code_verifier: "kurz" })],
  ])("lehnt ab: %s", async (_n, mutate) => {
    const { body: c } = await register();
    const { verifier, challenge } = pkce();
    const code = await getCode(c.client_id, challenge);
    const res = await tokenReq(mutate({ grant_type: "authorization_code", code, client_id: c.client_id, redirect_uri: REDIRECT, code_verifier: verifier }));
    expect(res.status).toBe(400);
    expect(await db.mcpToken.count()).toBe(0);
  });

  it("lehnt abgelaufene Codes ab", async () => {
    const { body: c } = await register();
    const { verifier, challenge } = pkce();
    const code = await getCode(c.client_id, challenge);
    await db.oAuthCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await tokenReq({ grant_type: "authorization_code", code, client_id: c.client_id, redirect_uri: REDIRECT, code_verifier: verifier });
    expect(res.status).toBe(400);
  });

  it("Code-Replay widerruft die bereits ausgestellten Token", async () => {
    const { client, verifier, code, tokens } = await fullFlow();
    expect((await mcpCall(tokens.access_token)).status).toBe(200);
    const replay = await tokenReq({ grant_type: "authorization_code", code, client_id: client.client_id, redirect_uri: REDIRECT, code_verifier: verifier });
    expect(replay.status).toBe(400);
    expect((await mcpCall(tokens.access_token)).status).toBe(401);
  });

  it("zwei parallele Einlösungen: höchstens eine gelingt", async () => {
    const { body: c } = await register();
    const { verifier, challenge } = pkce();
    const code = await getCode(c.client_id, challenge);
    const f = { grant_type: "authorization_code", code, client_id: c.client_id, redirect_uri: REDIRECT, code_verifier: verifier };
    const results = await Promise.all([tokenReq(f), tokenReq(f)]);
    expect(results.filter((r) => r.status === 200).length).toBeLessThanOrEqual(1);
  });

  it("lehnt unbekannte grant_types ab", async () => {
    const res = await tokenReq({ grant_type: "password", username: "a", password: "b" });
    expect((await res.json()).error).toBe("unsupported_grant_type");
  });

  it("abgelaufene Access-Token werden abgelehnt", async () => {
    const { tokens } = await fullFlow();
    await db.mcpToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await mcpCall(tokens.access_token)).status).toBe(401);
  });
});

describe("Refresh-Token", () => {
  it("rotiert: neues Paar gültig, altes Access-Token widerrufen", async () => {
    const { client, tokens } = await fullFlow({ grantWrite: true });
    const res = await tokenReq({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: client.client_id });
    expect(res.status).toBe(200);
    const next = await res.json();
    expect(next.refresh_token).not.toBe(tokens.refresh_token);
    expect(next.scope).toBe("read write_plan");
    expect((await mcpCall(next.access_token)).status).toBe(200);
    expect((await mcpCall(tokens.access_token)).status).toBe(401);
  });

  it("Wiederverwendung eines alten Refresh-Tokens sperrt die ganze Familie", async () => {
    const { client, tokens } = await fullFlow();
    const next = await (await tokenReq({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: client.client_id })).json();
    const reuse = await tokenReq({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: client.client_id });
    expect(reuse.status).toBe(400);
    expect((await mcpCall(next.access_token)).status).toBe(401);
    const afterwards = await tokenReq({ grant_type: "refresh_token", refresh_token: next.refresh_token, client_id: client.client_id });
    expect(afterwards.status).toBe(400);
  });

  it("bindet den Refresh-Token an den Client und prüft Ablauf/Format", async () => {
    const { client, tokens } = await fullFlow();
    const other = (await register()).body;
    expect((await tokenReq({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: other.client_id })).status).toBe(400);
    expect((await tokenReq({ grant_type: "refresh_token", refresh_token: tokens.access_token, client_id: client.client_id })).status).toBe(400);
    expect((await tokenReq({ grant_type: "refresh_token", refresh_token: "lhr_unbekannt", client_id: client.client_id })).status).toBe(400);
    await db.mcpToken.updateMany({ data: { refreshExpiresAt: new Date(Date.now() - 1000) } });
    expect((await tokenReq({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: client.client_id })).status).toBe(400);
  });

  it("widerrufene Token (CLI revoke) lassen sich nicht mehr erneuern", async () => {
    const { client, tokens } = await fullFlow();
    await db.mcpToken.updateMany({ data: { revokedAt: new Date() } });
    expect((await tokenReq({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: client.client_id })).status).toBe(400);
    expect((await mcpCall(tokens.access_token)).status).toBe(401);
  });
});

describe("safeCallbackPath", () => {
  const origin = "https://trainer.example.com";
  it.each([
    ["/oauth/authorize?client_id=x&state=a%20b", "/oauth/authorize?client_id=x&state=a%20b"],
    [`${origin}/oauth/authorize?x=1`, "/oauth/authorize?x=1"],
    ["https://evil.example/oauth", "/dashboard"],
    ["//evil.example", "/dashboard"],
    ["/\\evil.example", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    ["", "/dashboard"],
    [null, "/dashboard"],
  ])("%s", (input, expected) => {
    expect(safeCallbackPath(input as string | null, origin)).toBe(expected);
  });
});
