import { PrismaClient } from "@prisma/client";

// Vermeidet, dass im Next.js Dev-Modus (Hot Reload) bei jedem Reload eine neue
// PrismaClient-Instanz erzeugt wird.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
