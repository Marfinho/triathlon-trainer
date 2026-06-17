import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { getEffectiveLimits } from "@/lib/plan-config";
import { encryptApiKey } from "@/lib/crypto";
import { createOAuthState, verifyOAuthState } from "@/lib/oauth-state";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getProviderConfig,
  type OAuthProviderId,
} from "./providers";

/**
 * Generische OAuth2-Connect/Callback/Disconnect-Logik, von dünnen
 * Provider-Routen (strava/wahoo/withings) aufgerufen.
 */

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

function redirectUriFor(provider: OAuthProviderId): string {
  return `${baseUrl()}/api/integrations/${provider}/callback`;
}

async function withinIntegrationLimit(
  userId: string,
  plan: string,
  provider: OAuthProviderId,
): Promise<boolean> {
  const existing = await prisma.userIntegration.findFirst({ where: { userId, provider } });
  if (existing?.enabled) return true; // Aktualisierung einer bestehenden Verbindung zählt nicht neu.
  const limit = (await getEffectiveLimits(plan)).maxActiveIntegrations;
  if (!Number.isFinite(limit)) return true;
  const current = await prisma.userIntegration.count({ where: { userId, enabled: true } });
  return current < limit;
}

export async function handleConnect(provider: OAuthProviderId): Promise<NextResponse> {
  const { user, response } = await requireUser();
  if (response) return response;

  const cfg = getProviderConfig(provider);
  if (!cfg.clientId || !cfg.clientSecret) {
    return NextResponse.redirect(`${baseUrl()}/profile?integration_error=not_configured`);
  }
  if (!(await withinIntegrationLimit(user.userId, user.plan, provider))) {
    return NextResponse.redirect(`${baseUrl()}/profile?integration_error=limit_reached`);
  }

  const state = createOAuthState(user.userId);
  const url = buildAuthorizeUrl(provider, redirectUriFor(provider), state);
  return NextResponse.redirect(url);
}

export async function handleCallback(
  provider: OAuthProviderId,
  request: Request,
): Promise<NextResponse> {
  const { user, response } = await requireUser();
  if (response) return response;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${baseUrl()}/profile?integration_error=denied`);
  }
  if (!code || !state || !verifyOAuthState(state, user.userId)) {
    return NextResponse.redirect(`${baseUrl()}/profile?integration_error=invalid_state`);
  }
  if (!(await withinIntegrationLimit(user.userId, user.plan, provider))) {
    return NextResponse.redirect(`${baseUrl()}/profile?integration_error=limit_reached`);
  }

  try {
    const token = await exchangeCodeForToken(provider, code, redirectUriFor(provider));
    await prisma.userIntegration.upsert({
      where: { userId_provider: { userId: user.userId, provider } },
      create: {
        userId: user.userId,
        provider,
        apiKey: encryptApiKey(token.accessToken),
        refreshToken: token.refreshToken ? encryptApiKey(token.refreshToken) : null,
        tokenExpiresAt: token.expiresAt,
        scope: token.scope,
        athleteId: token.externalId,
        enabled: true,
      },
      update: {
        apiKey: encryptApiKey(token.accessToken),
        refreshToken: token.refreshToken ? encryptApiKey(token.refreshToken) : null,
        tokenExpiresAt: token.expiresAt,
        scope: token.scope,
        athleteId: token.externalId,
        enabled: true,
      },
    });
  } catch {
    return NextResponse.redirect(`${baseUrl()}/profile?integration_error=token_exchange_failed`);
  }

  return NextResponse.redirect(`${baseUrl()}/profile?connected=${provider}`);
}

export async function handleDisconnect(provider: OAuthProviderId): Promise<NextResponse> {
  const { user, response } = await requireUser();
  if (response) return response;

  await prisma.userIntegration.updateMany({
    where: { userId: user.userId, provider },
    data: { enabled: false },
  });

  return NextResponse.json({ ok: true, connected: false });
}
