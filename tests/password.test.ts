import { describe, it, expect } from "vitest";
import { validatePasswordStrength } from "@/domain/auth/password";

describe("validatePasswordStrength", () => {
  it("akzeptiert ein solides Passwort", () => {
    expect(validatePasswordStrength("Sommer2026")).toEqual({ ok: true, errors: [] });
  });

  it("lehnt zu kurze Passwörter ab", () => {
    const r = validatePasswordStrength("ab1");
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Mindestens 8"))).toBe(true);
  });

  it("verlangt Buchstabe und Ziffer", () => {
    expect(validatePasswordStrength("12345678").ok).toBe(false);
    expect(validatePasswordStrength("abcdefgh").ok).toBe(false);
  });

  it("blockt häufige Passwörter", () => {
    const r = validatePasswordStrength("password");
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("verbreitet"))).toBe(true);
  });

  it("lehnt überlange Passwörter ab", () => {
    const r = validatePasswordStrength("a1".repeat(150));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Höchstens"))).toBe(true);
  });
});
