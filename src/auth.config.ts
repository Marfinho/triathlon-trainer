import type { NextAuthConfig } from "next-auth";

/**
 * Edge-sichere Basiskonfiguration (ohne Prisma/bcrypt) – wird von der Middleware
 * verwendet. Die vollständige Konfiguration (Adapter, Provider) lebt in auth.ts.
 */
// Öffentlich: Auth-Flows, der von außen getriggerte Cron-Endpunkt und der
// signaturgeprüfte Stripe-Webhook (kann keine Session tragen).
const PUBLIC_PREFIXES = [
  "/auth",
  "/api/auth",
  "/api/cron",
  "/api/billing/webhook",
];

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/auth/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/" ||
        PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
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
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
