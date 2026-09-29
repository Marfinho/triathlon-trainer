import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";

function mockSystemDark(dark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: dark && query.includes("dark"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    mockSystemDark(false);
  });

  it("zeigt drei Optionen, „System“ ist ohne gespeicherte Wahl aktiv", () => {
    render(<ThemeToggle />);
    const group = screen.getByRole("radiogroup", { name: "Darstellung" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
  });

  it("setzt beim Klick auf „Dunkel“ data-theme und speichert die Wahl", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("radio", { name: "Dunkel" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("radio", { name: "Dunkel" })).toHaveAttribute("aria-checked", "true");
  });

  it("übernimmt eine gespeicherte Wahl", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(<ThemeToggle />);
    expect(screen.getByRole("radio", { name: "Hell" })).toHaveAttribute("aria-checked", "true");
  });

  it("„System“ folgt der Systemeinstellung", async () => {
    mockSystemDark(true);
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("radio", { name: "Hell" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("radio", { name: "System" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("ist per Tastatur bedienbar", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.tab();
    expect(screen.getByRole("radio", { name: "System" })).toHaveFocus();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
