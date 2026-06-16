import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export interface AuthedUser {
  userId: string;
  plan: string;
}

/** Liefert userId+plan oder eine 401-Response. Für alle geschützten API-Routen. */
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
    select: { plan: true },
  });
  return { user: { userId: session.user.id, plan: dbUser?.plan ?? "free" } };
}
