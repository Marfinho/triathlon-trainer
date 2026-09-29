import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "@/components/dashboard/Card";

describe("Card", () => {
  it("rendert Titel als Überschrift, Untertitel, Inhalt und Aktionen", () => {
    render(
      <Card title="Wochenplan" subtitle="KW 40" actions={<button type="button">Neu</button>}>
        <p>Inhalt</p>
      </Card>,
    );
    expect(screen.getByRole("heading", { name: "Wochenplan" })).toBeInTheDocument();
    expect(screen.getByText("KW 40")).toBeInTheDocument();
    expect(screen.getByText("Inhalt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Neu" })).toBeInTheDocument();
  });

  it("hat helle und dunkle Oberflächenklassen", () => {
    const { container } = render(<Card title="X">y</Card>);
    const section = container.querySelector("section");
    expect(section).toHaveClass("bg-white", "dark:bg-neutral-900");
  });
});
