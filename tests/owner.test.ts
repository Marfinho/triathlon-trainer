import { describe, it, expect } from "vitest";
import { isOwnerEmail, OWNER_ADMIN_EMAIL } from "@/lib/owner";

describe("isOwnerEmail", () => {
  it("erkennt die Betreiber-Adresse unabhängig von Groß-/Kleinschreibung", () => {
    expect(isOwnerEmail(OWNER_ADMIN_EMAIL)).toBe(true);
    expect(isOwnerEmail(" SvenMeendermann@Gmail.com ")).toBe(true);
  });

  it("lehnt andere Adressen ab", () => {
    expect(isOwnerEmail("someone@example.com")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
    expect(isOwnerEmail("")).toBe(false);
  });
});
