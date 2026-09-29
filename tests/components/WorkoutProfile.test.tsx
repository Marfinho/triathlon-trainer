import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkoutProfile } from "@/components/dashboard/WorkoutProfile";

describe("WorkoutProfile", () => {
  it("rendert nichts ohne Segmente (z. B. Ruhetag)", () => {
    const { container } = render(<WorkoutProfile segments={[]} ftp={250} sport="rest" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("zeigt beim Rad Watt-Ziele und Dauer je Segment", () => {
    render(
      <WorkoutProfile
        ftp={200}
        sport="bike"
        segments={[
          { type: "warmup", durationSec: 600, targetType: "power", targetValue: 120 },
          { type: "interval", durationSec: 300, targetType: "power", targetValue: 220 },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("10′");
    expect(items[1]).toHaveTextContent("5′");
    expect(items[1]).toHaveTextContent(/W/);
  });
});
