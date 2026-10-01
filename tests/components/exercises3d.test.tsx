import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { builtin3dExercises, getLibraryExercise } from "@/domain/exercises/library";
import type { Exercise3dDefinition } from "@/domain/exercises/body3d";
import { ExerciseDetail } from "@/components/exercises/ExerciseDetail";
import { Exercise3dViewer } from "@/components/exercises/Exercise3dViewer";
import { StrengthPlayer, type StrengthPlayerStep } from "@/components/exercises/StrengthPlayer";
import { NewExerciseExchange } from "@/components/exercises/NewExerciseExchange";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function mockMatchMedia(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduce && q.includes("reduce"),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => mockMatchMedia(false));
afterEach(() => vi.unstubAllGlobals());

const bridge = getLibraryExercise("glute-bridge") as Exercise3dDefinition;

describe("3D-Übungen im Server-Render", () => {
  it("Detailansicht: 3D-Animation, Muskelbild, Ablauf, Fehlerbild", () => {
    for (const def of builtin3dExercises) {
      const html = renderToString(<ExerciseDetail definition={def} />);
      expect(html).toContain("Animation in 3D");
      expect(html).toContain("b3fig");
      expect(html).toContain(def.frames[3].label.replace(/&/g, "&amp;").slice(0, 10));
      if (def.fault) expect(html).toContain(def.fault.caption.slice(0, 10));
      expect(html).not.toMatch(/NaN/);
    }
  });

  it("Viewer zeigt ohne JavaScript ein Standbild und das erste Phasen-Label", () => {
    const html = renderToString(<Exercise3dViewer definition={bridge} />);
    expect(html).toContain("<svg");
    expect(html).toContain(bridge.keyframes[0].label);
    expect(html).toContain("Körper");
    expect(html).toContain("Muskeln");
  });
});

describe("Exercise3dViewer (ohne WebGL)", () => {
  it("fällt auf die flache Ansicht zurück und schaltet auf Muskeln um", async () => {
    // jsdom hat kein WebGL → flache SVG-Ansicht
    render(<Exercise3dViewer definition={bridge} autoPlay={false} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Muskeln" }));
    expect(screen.getByRole("button", { name: "Muskeln" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(document.querySelector(".b3flat")!.innerHTML).toContain("b3m idle"));
    expect(screen.queryByText("Ansicht zurücksetzen")).toBeNull();
  });

  it("Scrubben stoppt und zeigt die passende Phase", async () => {
    render(<Exercise3dViewer definition={bridge} />);
    const slider = screen.getByLabelText("Position im Ablauf");
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(slider, { target: { value: "300" } });
    expect(screen.getByRole("button", { name: /Abspielen/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(bridge.keyframes[1].label)).toBeInTheDocument();
  });

  it("Bewegung reduzieren: startet pausiert im Zielbild", () => {
    mockMatchMedia(true);
    render(<Exercise3dViewer definition={bridge} />);
    expect(screen.getByRole("button", { name: /Abspielen/ })).toBeInTheDocument();
    expect(screen.getByText(bridge.keyframes[1].label)).toBeInTheDocument();
  });
});

describe("Kraft-Player mit 3D-Übung", () => {
  it("zeigt die kompakte 3D-Ansicht ohne Bedienelemente", () => {
    const steps: StrengthPlayerStep[] = [
      {
        kind: "exercise",
        exercise: { id: "glute-bridge", sets: 2, reps: 10, holdSec: null, restSec: 30, perSide: false, loadKg: null, note: null },
        definition: bridge,
        status: "ok",
        description: null,
      },
    ];
    render(<StrengthPlayer title="Kraft" date="2026-10-06" steps={steps} />);
    expect(screen.getByRole("region", { name: `3D-Animation: ${bridge.title}` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Muskeln" })).toBeNull();
  });
});

describe("NewExerciseExchange", () => {
  const template = "Wunsch: §W§ Ende";

  it("setzt den Wunsch in den Prompt ein (auch mit $-Zeichen)", async () => {
    const user = userEvent.setup();
    render(<NewExerciseExchange promptTemplate={template} placeholder="§W§" />);
    await user.click(screen.getByRole("button", { name: /Neue Übung mit KI/ }));
    await user.type(screen.getByLabelText(/Was soll die Übung trainieren/), "Wade $& dehnen");
    await user.click(screen.getByText("Prompt anzeigen"));
    expect((screen.getAllByRole("textbox").find((t) => (t as HTMLTextAreaElement).readOnly) as HTMLTextAreaElement).value).toBe(
      "Wunsch: Wade $& dehnen Ende",
    );
  });

  it("prüft, zeigt Fehler als Text und übernimmt erst nach Klick", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          ok: false,
          errors: [{ code: "EXERCISE_POSE_INVALID", message: "<b>Knie</b> zu weit", path: "keyframes[0]" }],
          warnings: [],
          preview: null,
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          errors: [],
          warnings: [],
          preview: { id: "hip-lift", title: "Hüftheben", subtitle: "Test", heroSvg: "<svg></svg>", muscles: [{ label: "Gesäß", role: "work" }], frames: [], fault: null },
        }),
      })
      .mockResolvedValueOnce({ json: async () => ({ ok: true, id: "hip-lift", change: "created", warnings: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<NewExerciseExchange promptTemplate={template} placeholder="§W§" />);
    await user.click(screen.getByRole("button", { name: /Neue Übung mit KI/ }));
    await user.click(screen.getByLabelText("Antwort der KI (JSON)"));
    await user.paste('{"format":"3d"}');
    await user.click(screen.getByRole("button", { name: "Prüfen" }));
    // KI-Text wird escaped angezeigt, nicht als HTML
    expect(await screen.findByText(/<b>Knie<\/b> zu weit/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Übung übernehmen" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Prüfen" }));
    const take = await screen.findByRole("button", { name: "Übung übernehmen" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await user.click(take);
    expect(await screen.findByText(/Gespeichert/)).toHaveAttribute("href", "/trainer/uebungen/hip-lift");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).mode).toBe("save");
    expect(refresh).toHaveBeenCalled();
  });
});
