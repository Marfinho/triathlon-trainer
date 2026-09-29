import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { builtinExercises } from "@/domain/exercises/library";
import {
  renderBodyAt,
  renderFaultSvg,
  renderFrameSvg,
  renderHeroSvg,
  timelineAt,
} from "@/domain/exercises/engine";

/**
 * Golden-Test: Die Ausgabe der Engine muss für alle 20 Übungen BYTE-GENAU den
 * Referenzdateien entsprechen. Weicht ein Test ab, ist der Port falsch – die
 * Golden-Dateien werden nie still angepasst.
 */
interface Golden {
  id: string;
  hero: string;
  frames: string[];
  fault: string | null;
  player: { u: number; svg: string }[];
  timeline: { tau: number; u: number; ph: number }[];
}

const dir = path.join(__dirname, "../fixtures/exercises/golden");

describe("Engine – Golden-Dateien", () => {
  it("es gibt für jede eingebaute Übung eine Golden-Datei", () => {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.map((f) => f.replace(/\.json$/, "")).sort()).toEqual(
      builtinExercises.map((e) => e.id).sort(),
    );
  });

  for (const def of builtinExercises) {
    describe(def.id, () => {
      const golden = JSON.parse(fs.readFileSync(path.join(dir, `${def.id}.json`), "utf8")) as Golden;

      it("Muskelbild", () => {
        expect(renderHeroSvg(def)).toBe(golden.hero);
      });

      it("Ablauf-Bilder 1–4", () => {
        expect(golden.frames).toHaveLength(4);
        golden.frames.forEach((svg, i) => {
          expect(renderFrameSvg(def, i)).toBe(svg);
        });
      });

      it("Fehlerbild", () => {
        expect(renderFaultSvg(def)).toBe(golden.fault);
      });

      it("Animation bei u = 0 … 1", () => {
        expect(golden.player.map((p) => p.u)).toEqual([0, 0.25, 0.5, 0.75, 1]);
        for (const p of golden.player) {
          expect(renderBodyAt(def, p.u)).toBe(p.svg);
        }
      });

      it("Timeline", () => {
        for (const step of golden.timeline) {
          expect(timelineAt(def.tempo, step.tau)).toEqual({ u: step.u, ph: step.ph });
        }
      });
    });
  }
});
