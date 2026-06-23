/**
 * Seed für die Produktion: Idempotent, erstellt nur den Admin-Benutzer,
 * wenn dieser nicht bereits existiert. Bestehende Daten bleiben erhalten.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

async function main() {
  const email = "svenmeendermann@gmail.com";
  const password = "admin";

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role !== "admin") {
      await prisma.user.update({
        where: { email },
        data: { role: "admin" },
      });
      console.log(`Updated ${email} to admin role.`);
    } else {
      console.log(`Admin user ${email} already exists.`);
    }
  } else {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email,
        name: "Admin",
        passwordHash,
        provider: "credentials",
        role: "admin",
      },
    });
    console.log(`Created admin user: ${user.email}`);
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
