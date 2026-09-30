import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";

export type TokenPurpose = "verify" | "reset" | "change";

export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  verify: 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
  change: 24 * 60 * 60 * 1000,
};

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const identifier = (purpose: TokenPurpose, email: string) => `${purpose}:${email}`;

/**
 * Erzeugt ein Einmal-Token (in der DB nur als SHA-256-Hash gespeichert) und
 * ersetzt vorherige Tokens gleichen Zwecks für diese Adresse.
 */
export async function createEmailToken(
  purpose: TokenPurpose,
  email: string,
  db: PrismaClient = defaultPrisma,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const id = identifier(purpose, email);
  await db.verificationToken.deleteMany({ where: { identifier: id } });
  await db.verificationToken.create({
    data: { identifier: id, token: hash(token), expires: new Date(Date.now() + TOKEN_TTL_MS[purpose]) },
  });
  return token;
}

/** Löst ein Token ein (einmalig). Liefert die E-Mail-Adresse oder null. */
export async function consumeEmailToken(
  purpose: TokenPurpose,
  token: string,
  db: PrismaClient = defaultPrisma,
): Promise<string | null> {
  const row = await db.verificationToken.findUnique({ where: { token: hash(token) } });
  if (!row || !row.identifier.startsWith(`${purpose}:`)) return null;
  // deleteMany: nur ein paralleler Request kann das Token erfolgreich einlösen.
  const { count } = await db.verificationToken.deleteMany({ where: { token: row.token } });
  if (count !== 1 || row.expires.getTime() < Date.now()) return null;
  return row.identifier.slice(purpose.length + 1);
}
