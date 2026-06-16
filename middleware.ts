import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-Middleware nutzt nur die schlanke Basiskonfiguration (kein Prisma/bcrypt).
// Geschützt sind alle Routen außer /, /auth/*, /api/auth/* und /api/cron/*.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
