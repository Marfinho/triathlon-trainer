import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // DB-Tests teilen sich eine PostgreSQL-Test-DB (siehe tests/helpers/testDb.ts).
    // Sequentielle Dateiausführung vermeidet Race-Conditions beim parallelen
    // Anlegen und hält die Suite zuverlässig grün.
    fileParallelism: false,
    // Tests mit verschlüsselten Tokens brauchen einen Schlüssel – unabhängig
    // davon, ob die aufrufende Shell/CI ihn setzt.
    env: { ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? "test-encryption-key" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
