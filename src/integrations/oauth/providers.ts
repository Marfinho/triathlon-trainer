/**
 * OAuth2-Provider-Konfiguration und Token-Austausch für Drittanbieter, die
 * Self-Service-OAuth anbieten (Strava, Wahoo, Withings). Garmin Connect bietet
 * keinen Self-Service-API-Zugang (nur über Partner-Vereinbarung) und ist
 * deshalb hier bewusst nicht enthalten.
 */
export type OAuthProviderId = "strava" | "wahoo" | "withings";

export interface OAuthProviderConfig {
  id: OAuthProviderId;
  label: string;
  authorizeUrl: string;
  scope: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  externalId: string | null;
  scope: string | null;
}

export function getProviderConfig(id: OAuthProviderId): OAuthProviderConfig {
  switch (id) {
    case "strava":
      return {
        id,
        label: "Strava",
        authorizeUrl: "https://www.strava.com/oauth/authorize",
        scope: "activity:read_all",
        clientId: process.env.STRAVA_CLIENT_ID,
        clientSecret: process.env.STRAVA_CLIENT_SECRET,
      };
    case "wahoo":
      return {
        id,
        label: "Wahoo",
        authorizeUrl: "https://api.wahooligan.com/oauth/authorize",
        scope: "user_read workouts_read",
        clientId: process.env.WAHOO_CLIENT_ID,
        clientSecret: process.env.WAHOO_CLIENT_SECRET,
      };
    case "withings":
      return {
        id,
        label: "Withings",
        authorizeUrl: "https://account.withings.com/oauth2_user/authorize2",
        scope: "user.metrics,user.activity",
        clientId: process.env.WITHINGS_CLIENT_ID,
        clientSecret: process.env.WITHINGS_CLIENT_SECRET,
      };
  }
}

export function buildAuthorizeUrl(
  id: OAuthProviderId,
  redirectUri: string,
  state: string,
): string {
  const cfg = getProviderConfig(id);
  const params = new URLSearchParams({
    client_id: cfg.clientId ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: cfg.scope,
    state,
  });
  if (id === "strava") params.set("approval_prompt", "auto");
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

async function exchangeStrava(cfg: OAuthProviderConfig, code: string): Promise<OAuthTokenResult> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Strava-Token-Austausch fehlgeschlagen (${res.status}).`);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
    externalId: data.athlete?.id != null ? String(data.athlete.id) : null,
    scope: null,
  };
}

async function fetchWahooUserId(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.wahooligan.com/v1/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.id != null ? String(data.id) : null;
  } catch {
    return null;
  }
}

async function exchangeWahoo(
  cfg: OAuthProviderConfig,
  code: string,
  redirectUri: string,
): Promise<OAuthTokenResult> {
  const res = await fetch("https://api.wahooligan.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId ?? "",
      client_secret: cfg.clientSecret ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Wahoo-Token-Austausch fehlgeschlagen (${res.status}).`);
  const data = await res.json();
  const externalId = await fetchWahooUserId(data.access_token);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    externalId,
    scope: typeof data.scope === "string" ? data.scope : null,
  };
}

/** Withings v2/oauth2: Antwort ist in { status, body } gewrappt (status 0 = ok). */
async function exchangeWithings(
  cfg: OAuthProviderConfig,
  code: string,
  redirectUri: string,
): Promise<OAuthTokenResult> {
  const res = await fetch("https://wbsapi.withings.net/v2/oauth2", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      action: "requesttoken",
      grant_type: "authorization_code",
      client_id: cfg.clientId ?? "",
      client_secret: cfg.clientSecret ?? "",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Withings-Token-Austausch fehlgeschlagen (${res.status}).`);
  const data = await res.json();
  if (data.status !== 0) {
    throw new Error(`Withings-Token-Austausch fehlgeschlagen (status ${data.status}).`);
  }
  const body = data.body ?? {};
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : null,
    externalId: body.userid != null ? String(body.userid) : null,
    scope: typeof body.scope === "string" ? body.scope : null,
  };
}

export async function exchangeCodeForToken(
  id: OAuthProviderId,
  code: string,
  redirectUri: string,
): Promise<OAuthTokenResult> {
  const cfg = getProviderConfig(id);
  if (id === "strava") return exchangeStrava(cfg, code);
  if (id === "wahoo") return exchangeWahoo(cfg, code, redirectUri);
  return exchangeWithings(cfg, code, redirectUri);
}

async function refreshStrava(cfg: OAuthProviderConfig, refreshTokenValue: string): Promise<OAuthTokenResult> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshTokenValue,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Strava-Token-Refresh fehlgeschlagen (${res.status}).`);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshTokenValue,
    expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
    externalId: null,
    scope: null,
  };
}

async function refreshWahoo(cfg: OAuthProviderConfig, refreshTokenValue: string): Promise<OAuthTokenResult> {
  const res = await fetch("https://api.wahooligan.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId ?? "",
      client_secret: cfg.clientSecret ?? "",
      refresh_token: refreshTokenValue,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Wahoo-Token-Refresh fehlgeschlagen (${res.status}).`);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshTokenValue,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    externalId: null,
    scope: typeof data.scope === "string" ? data.scope : null,
  };
}

async function refreshWithings(
  cfg: OAuthProviderConfig,
  refreshTokenValue: string,
): Promise<OAuthTokenResult> {
  const res = await fetch("https://wbsapi.withings.net/v2/oauth2", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      action: "requesttoken",
      grant_type: "refresh_token",
      client_id: cfg.clientId ?? "",
      client_secret: cfg.clientSecret ?? "",
      refresh_token: refreshTokenValue,
    }),
  });
  if (!res.ok) throw new Error(`Withings-Token-Refresh fehlgeschlagen (${res.status}).`);
  const data = await res.json();
  if (data.status !== 0) {
    throw new Error(`Withings-Token-Refresh fehlgeschlagen (status ${data.status}).`);
  }
  const body = data.body ?? {};
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? refreshTokenValue,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : null,
    externalId: null,
    scope: typeof body.scope === "string" ? body.scope : null,
  };
}

export async function refreshOAuthToken(
  id: OAuthProviderId,
  refreshTokenValue: string,
): Promise<OAuthTokenResult> {
  const cfg = getProviderConfig(id);
  if (id === "strava") return refreshStrava(cfg, refreshTokenValue);
  if (id === "wahoo") return refreshWahoo(cfg, refreshTokenValue);
  return refreshWithings(cfg, refreshTokenValue);
}
