import NextAuth, { CredentialsSignin } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { isOwnerEmail } from "@/lib/owner";
import { isMailConfigured } from "@/lib/mail";

class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

// Vergleichs-Hash für unbekannte Nutzer: gleiche Laufzeit wie ein echter
// bcrypt-Vergleich, damit sich existierende Konten nicht über Timing verraten.
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-not-a-password", 12);

/** Rolle aus der DB lesen; der Betreiber-Account wird dabei immer Admin. */
async function resolveRole(userId: string): Promise<string> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  if (!dbUser) return "user";
  if (isOwnerEmail(dbUser.email) && dbUser.role !== "admin") {
    await prisma.user.update({ where: { id: userId }, data: { role: "admin" } });
    return "admin";
  }
  return dbUser.role;
}

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
  callbacks: {
    ...authConfig.callbacks,
    jwt: async ({ token, user }) => {
      if (user?.id) token.id = user.id;
      // Rolle bei jedem Aufruf frisch aus der DB, damit Rollenänderungen im
      // Admin-Panel sofort greifen (statt erst nach bis zu 7 Tagen JWT-Laufzeit).
      if (typeof token.id === "string") {
        token.role = await resolveRole(token.id).catch(() => (token.role as string) ?? "user");
      }
      return token;
    },
  },
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
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
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
          await bcrypt.compare(password, DUMMY_HASH);
          await recordAudit({ action: "login_failed", ip, meta: { reason: "unknown_user" } });
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await recordAudit({ userId: user.id, action: "login_failed", ip });
          return null;
        }

        // Erst nach korrektem Passwort verraten, dass die Bestätigung fehlt.
        if ((await isMailConfigured()) && !user.emailVerified) throw new EmailNotVerifiedError();

        await recordAudit({ userId: user.id, action: "login_success", ip });
        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
});
