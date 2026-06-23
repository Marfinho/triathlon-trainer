import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

/**
 * Vollständige Auth.js-Konfiguration (Node-Runtime).
 * - Prisma-Adapter für OAuth-Account-Linking.
 * - JWT-Sessions (nötig für Credentials).
 * - Provider: Google OAuth + Credentials (E-Mail/Passwort, bcrypt).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  // Session-Härtung: begrenzte Lebensdauer (7 Tage), tägliche Rotation des
  // JWT und – in Produktion – ausschließlich über HTTPS gesetzte Cookies.
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      authorize: async (credentials, request) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // Brute-Force-Schutz: pro IP UND pro E-Mail begrenzen, damit weder ein
        // einzelner Angreifer noch ein Credential-Stuffing über viele IPs
        // unbegrenzt Versuche gegen ein Konto fahren kann.
        const ip = clientIp(request);
        const [ipLimit, emailLimit] = await Promise.all([
          checkRateLimit(`login-ip:${ip}`, 20, 15 * 60 * 1000),
          checkRateLimit(`login-email:${email.toLowerCase()}`, 10, 15 * 60 * 1000),
        ]);
        if (!ipLimit.allowed || !emailLimit.allowed) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) {
          await recordAudit({ action: "login_failed", ip, meta: { reason: "unknown_user" } });
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await recordAudit({ userId: user.id, action: "login_failed", ip });
          return null;
        }

        await recordAudit({ userId: user.id, action: "login_success", ip });
        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
});
