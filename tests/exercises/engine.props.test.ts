import { describe, it, expect } from "vitest";
import { builtinExercises, getBuiltinExercise } from "@/domain/exercises/library";
import type { ExerciseDefinition } from "@/domain/exercises/schema";
import {
  escapeXml,
  renderBodyAt,
  renderFaultSvg,
  renderFrameSvg,
  renderHeroSvg,
  renderPlayerShellSvg,
  renderThumbSvg,
  timelineAt,
} from "@/domain/exercises/engine";
import { toEngineExercise } from "@/domain/exercises/engine/adapter";
import { ik, len, sub } from "@/domain/exercises/engine/geometry";
import { limbPts, mixPose, normPose, torsoN } from "@/domain/exercises/engine/pose";

function allOutputs(def: ExerciseDefinition): string[] {
  const out = [renderHeroSvg(def), renderPlayerShellSvg(def), renderThumbSvg(def)];
  for (let i = 0; i < 4; i++) out.push(renderFrameSvg(def, i));
  const fault = renderFaultSvg(def);
  if (fault) out.push(fault);
  for (let k = 0; k <= 20; k++) out.push(renderBodyAt(def, k / 20));
  return out;
}

describe("Engine – Eigenschaften", () => {
  it("keine Ausgabe enthält NaN, undefined, null oder Infinity", () => {
    for (const def of builtinExercises) {
      for (const svg of allOutputs(def)) {
        expect(svg, def.id).not.toMatch(/NaN|undefined|Infinity|null/);
      }
    }
  });

  it("IK erhält die Knochenlängen (±0,5)", () => {
    for (const def of builtinExercises) {
      const ex = toEngineExercise(def);
      for (let k = 0; k <= 10; k++) {
        const pose = mixPose(ex.S, ex.T, k / 10);
        const u = sub(pose.N, pose.P);
        const l = len(u);
        const roots = { P: pose.P, N: sub(pose.N, [(u[0] / l) * 3, (u[1] / l) * 3]) };
        for (const limb of [...pose.far, ...pose.near]) {
          if (!limb.ik) continue;
          const pts = limbPts(limb, roots).pts;
          const [, , l1, l2] = limb.ik;
          expect(Math.abs(len(sub(pts[1], pts[0])) - l1), def.id).toBeLessThanOrEqual(0.5);
          expect(Math.abs(len(sub(pts[2], pts[1])) - l2), def.id).toBeLessThanOrEqual(0.5);
        }
      }
    }
  });

  it("IK kürzt unerreichbare Ziele auf die maximale Reichweite", () => {
    const [joint, end] = ik([0, 0], [500, 0], 30, 30, 1);
    expect(len(end)).toBeCloseTo(59.95, 5);
    expect(len(joint)).toBeCloseTo(30, 1);
  });

  it("mixPose(start, end, 0/1) reproduziert Start und Ende", () => {
    for (const def of builtinExercises) {
      const ex = toEngineExercise(def);
      const a = mixPose(ex.S, ex.T, 0);
      const s = normPose(ex.S);
      expect(a.P).toEqual(s.P);
      expect(a.N).toEqual(s.N);
      expect(a.H).toEqual(s.H);
      const b = mixPose(ex.S, ex.T, 1);
      const t = normPose(ex.T);
      expect(b.P).toEqual(t.P);
      expect(b.N).toEqual(torsoN(ex.T));
      for (let i = 0; i < b.near.length; i++) {
        const bi = b.near[i].ik?.[0] ?? b.near[i].pts;
        const ti = t.near[i].ik?.[0] ?? t.near[i].pts;
        expect(bi, def.id).toEqual(ti);
      }
    }
  });

  it("ist deterministisch", () => {
    const def = getBuiltinExercise("side-plank")!;
    expect(renderHeroSvg(def)).toBe(renderHeroSvg(structuredClone(def)));
    expect(renderBodyAt(def, 0.37)).toBe(renderBodyAt(def, 0.37));
  });

  it("begrenzt u auf 0…1 und fängt NaN ab", () => {
    const def = getBuiltinExercise("glute-bridge")!;
    expect(renderBodyAt(def, -3)).toBe(renderBodyAt(def, 0));
    expect(renderBodyAt(def, 7)).toBe(renderBodyAt(def, 1));
    expect(renderBodyAt(def, Number.NaN)).toBe(renderBodyAt(def, 0));
  });

  it("Timeline durchläuft die vier Phasen", () => {
    const tempo = { toEndSec: 1, holdEndSec: 1, toStartSec: 1, holdStartSec: 1 };
    expect(timelineAt(tempo, 0)).toEqual({ u: 0, ph: 0 });
    expect(timelineAt(tempo, 0.5).ph).toBe(0);
    expect(timelineAt(tempo, 1.5)).toEqual({ u: 1, ph: 1 });
    expect(timelineAt(tempo, 2.5).ph).toBe(2);
    expect(timelineAt(tempo, 3.5)).toEqual({ u: 0, ph: 3 });
  });
});

describe("Engine – Escaping", () => {
  it("escapeXml ersetzt & < > \" '", () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe("a&amp;b&lt;c&gt;d&quot;e&#x27;f");
  });

  it("Label und Titel erscheinen nur escaped", () => {
    const def = structuredClone(getBuiltinExercise("dead-bug")!) as ExerciseDefinition;
    const evil = "<script>alert(1)</script>";
    def.title = evil;
    def.frames[0].label = `"><img src=x onerror=alert(1)>`;
    def.start.annotations = [{ type: "label", text: evil, at: [10, 10], anchor: "start" }];
    const svgs = [
      renderHeroSvg(def),
      renderFrameSvg(def, 0),
      renderPlayerShellSvg(def),
      renderThumbSvg(def),
    ];
    for (const svg of svgs) {
      expect(svg).not.toContain("<script");
      expect(svg).not.toContain("<img");
    }
    expect(renderFrameSvg(def, 0)).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(renderFrameSvg(def, 0)).toContain("&quot;&gt;&lt;img");
  });
});
