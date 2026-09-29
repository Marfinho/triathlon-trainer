/**
 * Darstellung (Hell/Dunkel). Die Wahl ist eine reine Geräte-Einstellung und
 * liegt im localStorage; „system" folgt `prefers-color-scheme`.
 * Das aufgelöste Theme steht als `data-theme="light|dark"` am <html>-Element,
 * darauf baut die Tailwind-Variante `dark:` (siehe globals.css) auf.
 */
export const THEME_STORAGE_KEY = "localhub-theme";
export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

export function parseThemePreference(value: unknown): ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value)
    ? (value as ThemePreference)
    : "system";
}

export function resolveTheme(pref: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

/**
 * Inline-Skript für den <head>: setzt `data-theme` vor dem ersten Paint, damit
 * die Seite im Dunkelmodus nicht hell aufblitzt. Bewusst ohne Abhängigkeiten.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

/** Liest die gespeicherte Wahl (robust gegen gesperrten Speicher). */
export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** Speichert die Wahl und setzt das aufgelöste Theme am <html>-Element. */
export function applyThemePreference(pref: ThemePreference): ResolvedTheme {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Speicher nicht verfügbar (privater Modus): nur für diese Sitzung anwenden.
  }
  const systemDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveTheme(pref, systemDark);
  document.documentElement.dataset.theme = resolved;
  return resolved;
}
