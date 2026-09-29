import { describe, it, expect } from "vitest";
import { parseThemePreference, resolveTheme, THEME_INIT_SCRIPT } from "@/lib/theme";

describe("theme", () => {
  it("akzeptiert nur bekannte Werte, sonst „system“", () => {
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("blau")).toBe("system");
    expect(parseThemePreference(null)).toBe("system");
  });

  it("löst „system“ über die Systemeinstellung auf", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("Init-Skript ist ein in sich geschlossener IIFE", () => {
    expect(THEME_INIT_SCRIPT.startsWith("(function(){")).toBe(true);
    expect(THEME_INIT_SCRIPT).toContain("localhub-theme");
    expect(THEME_INIT_SCRIPT).not.toContain("</script");
  });
});
