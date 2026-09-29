/**
 * Seed für die Produktion: idempotent, stellt nur sicher, dass der
 * Betreiber-Account existiert und Admin ist. Bestehende Daten bleiben erhalten.
 *
 * Passwort: aus SEED_ADMIN_PASSWORD, sonst ein zufälliges, das einmalig im Log
 * ausgegeben wird. Ein noch vorhandenes altes Standardpasswort ("admin") wird
 * dabei automatisch ersetzt.
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { OWNER_ADMIN_EMAIL } from "../src/lib/owner";

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;
const LEGACY_DEFAULT_PASSWORD = "admin";

function initialPassword(): { password: string; generated: boolean } {
  const fromEnv = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (fromEnv) return { password: fromEnv, generated: false };
  return { password: randomBytes(12).toString("base64url"), generated: true };
}

function announce(password: string, generated: boolean) {
  if (generated) {
    console.log(
      `Initiales Admin-Passwort für ${OWNER_ADMIN_EMAIL}: ${password}\n` +
        "Bitte nach dem ersten Login im Profil ändern.",
    );
  } else {
    console.log(`Admin-Passwort für ${OWNER_ADMIN_EMAIL} aus SEED_ADMIN_PASSWORD gesetzt.`);
  }
}

async function main() {
  const email = OWNER_ADMIN_EMAIL;
  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const { password, generated } = initialPassword();
    await prisma.user.create({
      data: {
        email,
        name: "Admin",
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        provider: "credentials",
        role: "admin",
        athleteProfiles: { create: { name: "Admin" } },
      },
    });
    console.log(`Admin-Benutzer ${email} angelegt.`);
    announce(password, generated);
    return;
  }

  const data: { role?: string; passwordHash?: string } = {};
  if (existing.role !== "admin") data.role = "admin";

  if (
    existing.passwordHash &&
    (await bcrypt.compare(LEGACY_DEFAULT_PASSWORD, existing.passwordHash))
  ) {
    const { password, generated } = initialPassword();
    data.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    console.log("Unsicheres Standardpasswort erkannt – wird ersetzt.");
    announce(password, generated);
  }

  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { email }, data });
  }
  console.log(`Admin-Benutzer ${email} ist eingerichtet.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
