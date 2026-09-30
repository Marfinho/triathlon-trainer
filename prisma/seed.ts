/**
 * Seed (optional, SEED_ON_START=true): legt KEINE Nutzer an und ändert keine
 * Passwörter. Er gibt nur einem bereits bestehenden Nutzer mit der
 * Admin-E-Mail die Admin-Rolle. (Beim Login passiert das ohnehin automatisch.)
 */
import { PrismaClient } from "@prisma/client";
import { OWNER_ADMIN_EMAIL } from "../src/lib/owner";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: { email: OWNER_ADMIN_EMAIL, role: { not: "admin" } },
    data: { role: "admin" },
  });
  console.log(
    result.count > 0
      ? `${OWNER_ADMIN_EMAIL} ist jetzt Admin.`
      : `Keine Änderung nötig (${OWNER_ADMIN_EMAIL} ist Admin oder noch nicht registriert).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
