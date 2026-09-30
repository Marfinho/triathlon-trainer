import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { builtinExercises, getBuiltinExercise } from "@/domain/exercises/library";
import { renderThumbSvg } from "@/domain/exercises/engine";
import { ExerciseDetail } from "@/components/exercises/ExerciseDetail";
import { ExerciseAnimation } from "@/components/exercises/ExerciseAnimation";
import { ExerciseMuscleView } from "@/components/exercises/ExerciseMuscleView";
import { ExerciseStrip } from "@/components/exercises/ExerciseStrip";
import { ExerciseLibraryBrowser, type LibraryListItem } from "@/components/exercises/ExerciseLibraryBrowser";
import { PlanExercisePreview } from "@/components/exercises/PlanExercisePreview";
import { StrengthPlayer, type StrengthPlayerStep } from "@/components/exercises/StrengthPlayer";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function mockMatchMedia(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduce && q.includes("reduce"),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => mockMatchMedia(false));

const plank = getBuiltinExercise("plank")!;
const deadBug = getBuiltinExercise("dead-bug")!;

describe("Server-Render (Smoke)", () => {
  it("rendert jede Detailansicht mit Titel und SVG", () => {
    for (const def of builtinExercises) {
      const html = renderToString(<ExerciseDetail definition={def} />);
      expect(html, def.id).toContain(def.title.replace(/&/g, "&amp;"));
      expect(html, def.id).toContain("<svg");
      expect(html, def.id).not.toContain("NaN");
    }
  });

  it("zeigt das Fehlerbild nur, wenn vorhanden", () => {
    expect(renderToString(<ExerciseDetail definition={plank} />)).toContain("Häufiger Fehler bei Plank");
    expect(renderToString(<ExerciseDetail definition={deadBug} />)).not.toContain("Häufiger Fehler bei");
  });
});

describe("ExerciseMuscleView / ExerciseStrip", () => {
  it("nummeriert die Legende und markiert Dehnung", () => {
    const hip = getBuiltinExercise("hip-flexor-stretch")!;
    render(<ExerciseMuscleView definition={hip} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(hip.muscles.length);
    expect(screen.getAllByText("wird gedehnt").length).toBeGreaterThan(0);
  });

  it("zeigt vier Bilder mit Bildunterschrift", () => {
    render(<ExerciseStrip definition={deadBug} />);
    expect(screen.getAllByRole("figure")).toHaveLength(4);
    const captions = screen.getAllByRole("figure").map((f) => f.querySelector("figcaption")?.textContent);
    deadBug.frames.forEach((f, i) => expect(captions[i]).toBe(`${i + 1}${f.label}`));
  });
});

describe("ExerciseAnimation", () => {
  it("startet abspielend, Pause per Tastatur, Tempo und Scrub bedienbar", async () => {
    const user = userEvent.setup();
    render(<ExerciseAnimation definition={deadBug} />);
    const btn = screen.getByRole("button", { name: /Pause/ });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    btn.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /Abspielen/ })).toHaveAttribute("aria-pressed", "false");
    await user.selectOptions(screen.getByRole("combobox"), "1.5");
    expect(screen.getByRole("combobox")).toHaveValue("1.5");
    expect(screen.getByLabelText("Position im Ablauf")).toBeInTheDocument();
  });

  it("startet bei „Bewegung reduzieren“ pausiert in der Endposition", () => {
    mockMatchMedia(true);
    const { container } = render(<ExerciseAnimation definition={deadBug} />);
    expect(screen.getByRole("button", { name: /Abspielen/ })).toBeInTheDocument();
    // Phase 1 = „Halten am Ende“ → Label von Bild 3.
    expect(screen.getByText(deadBug.frames[2].label, { selector: "p" })).toBeInTheDocument();
    expect(container.querySelector(".dyn")?.innerHTML).not.toBe("");
  });
});

describe("ExerciseLibraryBrowser", () => {
  const items: LibraryListItem[] = builtinExercises.map((d) => ({
    id: d.id,
    title: d.title,
    subtitle: d.subtitle,
    category: d.category,
    muscles: d.muscles.map((m) => m.label),
    custom: false,
    thumbSvg: renderThumbSvg(d),
  }));

  it("filtert nach Kategorie und sucht nach Muskel", async () => {
    const user = userEvent.setup();
    render(<ExerciseLibraryBrowser items={items} />);
    expect(screen.getByText("20 Übungen")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Mobility" }));
    const mobility = builtinExercises.filter((e) => e.category === "mobility").length;
    expect(screen.getByText(`${mobility} Übungen`)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Alle" }));
    await user.type(screen.getByRole("searchbox"), "adduktor");
    const list = screen.getByRole("list");
    expect(within(list).getByText("Copenhagen Plank")).toBeInTheDocument();
    expect(within(list).getAllByRole("link")[0]).toHaveAttribute("href", "/trainer/uebungen/copenhagen-plank");
  });
});

describe("PlanExercisePreview", () => {
  it("zeigt Anzahl und Status eigener Definitionen", () => {
    render(
      <PlanExercisePreview
        summary={{ used: ["plank", "bird-dog"], segmentCount: 3, custom: [{ id: "bird-dog", title: "Bird Dog", valid: true }] }}
        customPreviews={[
          { index: 0, id: "bird-dog", title: "Bird Dog", valid: true, error: null, startSvg: "<svg></svg>", endSvg: "<svg></svg>" },
          { index: 1, id: "kaputt", title: null, valid: false, error: "frames: zu kurz", startSvg: null, endSvg: null },
        ]}
      />,
    );
    expect(screen.getByText(/Übungssegmente/)).toHaveTextContent("3 Übungssegmente, 2 verschiedene Übungen, davon 1 eigene.");
    expect(screen.getByText("gültig")).toBeInTheDocument();
    expect(screen.getByText("ungültig")).toBeInTheDocument();
    expect(screen.getByText("frames: zu kurz")).toBeInTheDocument();
  });
});

describe("StrengthPlayer", () => {
  const steps: StrengthPlayerStep[] = [
    {
      kind: "exercise",
      exercise: { id: "plank", sets: 1, reps: null, holdSec: 2, restSec: 0, perSide: false, loadKg: null, note: "Bauch fest" },
      definition: plank,
      status: "ok",
      description: null,
    },
    { kind: "text", description: "Locker auslaufen", segmentType: "cooldown", durationSec: 300 },
    {
      kind: "exercise",
      exercise: { id: "bird-dog", sets: 1, reps: 8, holdSec: null, restSec: 0, perSide: true, loadKg: null, note: null },
      definition: null,
      status: "missing",
      description: null,
    },
  ];

  it("führt durch Halten-Countdown, Textschritt und Platzhalter", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StrengthPlayer title="Kraft B" date="2026-10-06" steps={steps} />);
    expect(screen.getByText("Schritt 1 von 3")).toBeInTheDocument();
    expect(screen.getByText("Bauch fest")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Halten starten" }));
    expect(screen.getByText("Halten")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByText("Übung erledigt")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByText("Locker auslaufen")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByRole("img", { name: /bird-dog/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Einheit beenden" }));
    expect(screen.getByText("Einheit geschafft!")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
