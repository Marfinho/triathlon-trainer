import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Nach jedem Komponententest den DOM leeren, damit Tests unabhängig bleiben.
afterEach(() => {
  cleanup();
});
