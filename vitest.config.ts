import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // DB-Tests legen je Datei eine eigene SQLite-DB via `prisma db push` an.
    // Sequentielle Dateiausführung vermeidet Race-Conditions beim parallelen
    // Anlegen und hält die Suite zuverlässig grün.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
