import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BODY_BONES, BODY_REGIONS, BODY_REST_POSE, parseBodyModel } from "@/domain/exercises/body3d/bodyModel";
import { forwardKinematics, type BodyFrames } from "@/domain/exercises/body3d/kinematics";
import { buildScene } from "@/domain/exercises/body3d/scene";
import { DIMS } from "@/domain/exercises/body3d/skeleton";
import type { Exercise3dDefinition } from "@/domain/exercises/body3d";

const file = fs.readFileSync(path.join(process.cwd(), "public/models/body.bin"));
const model = parseBodyModel(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));

/** CPU-Skinning wie im Shader (lineares Blend-Skinning). */
function skin(frames: BodyFrames): Float32Array {
  const inv = model.restMatrices.map((m) => {
    // Ruhe-Matrix (spaltenweise) invertieren: R^T, −R^T·t
    const R = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
    const t = [m[12], m[13], m[14]];
    return { R, t };
  });
  const out = new Float32Array(model.position.length);
  for (let i = 0; i < model.vertexCount; i++) {
    const p = [model.position[i * 3], model.position[i * 3 + 1], model.position[i * 3 + 2]];
    for (let k = 0; k < 4; k++) {
      const w = model.skinWeight[i * 4 + k] / 255;
      if (!w) continue;
      const b = model.skinIndex[i * 4 + k];
      const { R, t } = inv[b];
      const d = [p[0] - t[0], p[1] - t[1], p[2] - t[2]];
      // lokal = R^T · d
      const l = [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]];
      const f = frames[model.bones[b]];
      for (let c = 0; c < 3; c++)
        out[i * 3 + c] += w * (f.origin[c] + f.R[c * 3] * l[0] + f.R[c * 3 + 1] * l[1] + f.R[c * 3 + 2] * l[2]);
    }
  }
  return out;
}

const minMaxY = (a: Float32Array) => {
  let lo = Infinity,
    hi = -Infinity;
  for (let i = 1; i < a.length; i += 3) {
    lo = Math.min(lo, a[i]);
    hi = Math.max(hi, a[i]);
  }
  return [lo, hi];
};

describe("Körpermodell (public/models/body.bin)", () => {
  it("passt zum Skelett: Knochen, Gewichte, Bereiche, Muskelzonen", () => {
    expect(model.bones).toEqual(BODY_BONES);
    expect(model.vertexCount).toBeGreaterThan(30000);
    for (let i = 0; i < model.vertexCount; i++) {
      const sum = model.skinWeight[i * 4] + model.skinWeight[i * 4 + 1] + model.skinWeight[i * 4 + 2] + model.skinWeight[i * 4 + 3];
      if (sum !== 255) throw new Error(`Eckpunkt ${i}: Gewichtssumme ${sum}`);
    }
    for (const r of Object.values(BODY_REGIONS)) expect(model.region.includes(r)).toBe(true);
    const fake = { props: [], muscles: [] } as unknown as Exercise3dDefinition;
    const instances = buildScene(fake, { joints: {}, contacts: {} }, { mode: "muscles" })
      .primitives.filter((p) => p.kind === "muscle")
      .map((p) => p.id);
    expect(model.muscles).toEqual(instances);
  });

  it("Ruhepose verändert nichts", () => {
    const rest = skin(forwardKinematics(BODY_REST_POSE as never, [0, DIMS.pelvisHeight, 0]));
    let maxErr = 0;
    for (let i = 0; i < rest.length; i++) maxErr = Math.max(maxErr, Math.abs(rest[i] - model.position[i]));
    expect(maxErr).toBeLessThan(0.05);
  });

  it("Neutralstellung: steht auf dem Boden, ca. 175 cm groß, nichts reißt aus", () => {
    const p = skin(forwardKinematics({}, [0, DIMS.pelvisHeight, 0]));
    const [lo, hi] = minMaxY(p);
    expect(lo).toBeGreaterThan(-3);
    expect(lo).toBeLessThan(3);
    expect(hi).toBeGreaterThan(170);
    expect(hi).toBeLessThan(180);
    // keine Ausreißer: jede Kante bleibt kurz
    let maxEdge = 0;
    for (let t = 0; t < model.index.length; t += 3)
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const i = model.index[t + a],
          j = model.index[t + b];
        maxEdge = Math.max(maxEdge, Math.hypot(p[i * 3] - p[j * 3], p[i * 3 + 1] - p[j * 3 + 1], p[i * 3 + 2] - p[j * 3 + 2]));
      }
    expect(maxEdge).toBeLessThan(6);
  });

  it("lehnt fremde Dateien ab", () => {
    expect(() => parseBodyModel(new TextEncoder().encode("XXXX\u0000\u0000\u0000\u0000").buffer as ArrayBuffer)).toThrow(/Format/);
  });
});
