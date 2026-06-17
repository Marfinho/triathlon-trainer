import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export interface AuthedUser {
  userId: string;
  plan: string;
  role: string;
}

/** Liefert userId+plan+role oder eine 401-Response. Für alle geschützten API-Routen. */
export async function requireUser(): Promise<
  | { user: AuthedUser; response?: undefined }
  | { user?: undefined; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, role: true },
  });
  return {
    user: {
      userId: session.user.id,
      plan: dbUser?.plan ?? "free",
      role: dbUser?.role ?? "user",
    },
  };
}

/**
 * Liefert den Nutzer nur, wenn er Admin ist – sonst 401 (kein Login) bzw.
 * 403 (eingeloggt, aber keine Admin-Rolle). Für alle Admin-Routen.
 */
export async function requireAdmin(): Promise<
  | { user: AuthedUser; response?: undefined }
  | { user?: undefined; response: NextResponse }
> {
  const result = await requireUser();
  if (result.response) return result;
  if (result.user.role !== "admin") {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return result;
}
