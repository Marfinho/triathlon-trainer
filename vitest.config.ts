import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    // DB-Tests teilen sich eine PostgreSQL-Test-DB (tests/helpers/testDb.ts).
    // Sequentielle Dateiausführung vermeidet Race-Conditions beim parallelen
    // Anlegen und hält die Suite zuverlässig grün.
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
        },
      },
      {
        // Komponententests (React Testing Library) laufen in jsdom.
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/**/*.test.tsx", "src/**/*.test.tsx"],
          setupFiles: ["./tests/helpers/setupComponents.ts"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
