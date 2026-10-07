import type { NextAuthConfig } from "next-auth";

/**
 * Edge-sichere Basiskonfiguration (ohne Prisma/bcrypt) – wird von der Middleware
 * verwendet. Die vollständige Konfiguration (Adapter, Provider) lebt in auth.ts.
 */
// Öffentlich: Auth-Flows, der von außen getriggerte Cron-Endpunkt und der
// signaturgeprüfte Stripe-Webhook und der Token-geschützte MCP-Endpunkt
// (können keine Session tragen).
const PUBLIC_PREFIXES = [
  "/auth",
  "/legal",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/api/auth",
  "/api/cron",
  "/api/billing/webhook",
  // Remote-MCP: eigene Bearer-Token-Authentifizierung im Handler (kein Cookie).
  "/api/mcp",
  // OAuth für den MCP-Connector: Register/Token sind öffentlich (PKCE-geschützt);
  // /api/oauth/consent verlangt trotzdem eine Session (im Handler). Die
  // Zustimmungsseite /oauth/authorize selbst bleibt login-pflichtig.
  "/api/oauth",
  // Geräte-Kopplung (RFC 8628) und TV-App: Code/Token-Endpunkte sind öffentlich bzw.
  // nutzen Geräte-Token (`lht_`); /api/device/verify|tokens verlangen im Handler eine
  // Session. /api/live akzeptiert Session ODER Geräte-Token. Die Seite /device bleibt
  // login-pflichtig.
  "/api/device",
  "/api/tv",
  // Sprechtext für Sprachassistenten (Home Assistant): Geräte-Token mit Scope "voice" oder Session.
  "/api/voice",
  // ICS-Kalenderfeed: Kalender-Clients können keinen Header senden → Geräte-Token (Scope "calendar") per Query oder Session.
  "/api/calendar",
  // Übungsanimation für die TV-App (WebView): prüft Geräte-Token/Session selbst.
  "/tv/",
  // Statisches 3D-Körpermodell (keine Nutzerdaten) – wird von /tv/exercise in der WebView ohne Cookie geladen.
  "/models/",
  "/api/live",
  // Von MCP-Clients geprobte Discovery-Pfade sollen sauber 404 liefern statt Login-Redirect.
  "/.well-known",
];

// OAuth-Callbacks der Anbieter: Withings prüft die URL beim Registrieren ohne
// Session. Der Handler verlangt für den echten Code-Austausch weiterhin eine Session.
const PUBLIC_PATTERNS = [/^\/api\/integrations\/[^/]+\/callback\/?$/];

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/auth/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/" ||
        PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
        PUBLIC_PATTERNS.some((re) => re.test(pathname));
      if (isPublic) return true;
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
