import type { BoneName } from "./skeleton";

/**
 * Körpermodell für den 3D-Viewer (public/models/body.bin), erzeugt mit
 * scripts/body-model/build.ts aus Blender „Human Base Meshes“ (CC0).
 * Rein und ohne three.js – Parser und Konstanten sind testbar.
 */

export const BODY_MODEL_MAGIC = "BRK1";
export const BODY_MODEL_URL = "/models/body.bin";

/** Reihenfolge der Knochen im Modell (Skinning-Index). */
export const BODY_BONES: readonly BoneName[] = [
  "pelvis",
  "spine_low",
  "spine_up",
  "neck",
  "thigh_l",
  "shank_l",
  "foot_l",
  "thigh_r",
  "shank_r",
  "foot_r",
  "upperarm_l",
  "forearm_l",
  "upperarm_r",
  "forearm_r",
];

/** Bereiche je Eckpunkt (Kleidung/Haut). */
export const BODY_REGIONS = { skin: 0, shirt: 1, shorts: 2, shoe: 3, hair: 4, eye: 5 } as const;

/** A-Haltung des Modells als Gelenkwinkel (Ruhepose des Skinnings). */
export const BODY_REST_POSE = {
  shoulder_l: { abd: 22, flex: 2 },
  shoulder_r: { abd: 22, flex: 2 },
  elbow_l: { flex: 14 },
  elbow_r: { flex: 14 },
  hip_l: { abd: 5, flex: -3 },
  hip_r: { abd: 5, flex: -3 },
  knee_l: { flex: 2 },
  knee_r: { flex: 2 },
} as const;

export interface BodyModelData {
  vertexCount: number;
  bones: BoneName[];
  /** je Knochen 16 Werte, spaltenweise (Ruhepose, Welt) */
  restMatrices: number[][];
  /** Muskel-Instanzen, z. B. "gluteus_maximus_r", "rectus_abdominis_c" */
  muscles: string[];
  /** cm */
  position: Float32Array;
  index: Uint16Array | Uint32Array;
  skinIndex: Uint8Array;
  skinWeight: Uint8Array;
  muscleIndex: Uint8Array;
  muscleWeight: Uint8Array;
  region: Uint8Array;
}

/** Liest die Binärdatei; wirft bei falschem Format. */
export function parseBodyModel(buf: ArrayBuffer): BodyModelData {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== BODY_MODEL_MAGIC) throw new Error("Körpermodell: unbekanntes Format");
  const hlen = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hlen)));
  const base = Math.ceil((8 + hlen) / 4) * 4;
  const L = header.layout as Record<string, { offset: number; length: number; type: string }>;
  const slice = (name: string) => buf.slice(base + L[name].offset, base + L[name].offset + L[name].length);
  const raw = new Int16Array(slice("position"));
  const position = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) position[i] = raw[i] * header.positionScale;
  return {
    vertexCount: header.vertexCount,
    bones: header.bones,
    restMatrices: header.restMatrices,
    muscles: header.muscles,
    position,
    index: L.index.type === "Uint16Array" ? new Uint16Array(slice("index")) : new Uint32Array(slice("index")),
    skinIndex: new Uint8Array(slice("skinIndex")),
    skinWeight: new Uint8Array(slice("skinWeight")),
    muscleIndex: new Uint8Array(slice("muscleIndex")),
    muscleWeight: new Uint8Array(slice("muscleWeight")),
    region: new Uint8Array(slice("region")),
  };
}
