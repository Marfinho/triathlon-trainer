import { describe, it, expect } from "vitest";
import { sanitizeText, sanitizeOptionalText } from "@/domain/security/sanitize";

describe("sanitizeText", () => {
  it("trimmt Rand-Whitespace", () => {
    expect(sanitizeText("  hallo  ")).toBe("hallo");
  });

  it("behält Tab und Zeilenumbruch", () => {
    expect(sanitizeText("a\tb\nc")).toBe("a\tb\nc");
  });

  it("entfernt Steuerzeichen (z. B. NUL und BEL)", () => {
    const withControls = "a" + String.fromCharCode(0) + "b" + String.fromCharCode(7) + "c";
    expect(sanitizeText(withControls)).toBe("abc");
  });

  it("kürzt auf die Maximallänge", () => {
    expect(sanitizeText("x".repeat(20), 5)).toBe("xxxxx");
  });

  it("liefert leeren String für Nicht-Strings", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(42)).toBe("");
  });
});

describe("sanitizeOptionalText", () => {
  it("liefert null für leere Eingaben", () => {
    expect(sanitizeOptionalText("   ")).toBeNull();
    expect(sanitizeOptionalText(" ")).toBeNull();
  });

  it("liefert den bereinigten Text sonst", () => {
    expect(sanitizeOptionalText("  ok  ")).toBe("ok");
  });
});
