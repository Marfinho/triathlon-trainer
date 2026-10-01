import type { BoneName } from "./skeleton";
import type { V3 } from "./math";

/**
 * Muskelkatalog: Jeder Muskel ist eine Spindel zwischen Ursprung und Ansatz
 * am Skelett (Offsets im Knochen-Frame, cm; z wird je Seite mit s gespiegelt).
 * Dadurch verkürzt bzw. dehnt er sich automatisch mit der Bewegung.
 */
export interface MuscleGeometry {
  label: string;
  /** "pair" = links + rechts, "center" = einmal mittig */
  kind: "pair" | "center";
  origin: { bone: BoneName | SidedBone; offset: V3 };
  insertion: { bone: BoneName | SidedBone; offset: V3 };
  radius: number;
  /** Abflachung senkrecht zur Körperoberfläche (1 = rund) */
  flat?: number;
}

/** Knochen mit Seitenplatzhalter, z. B. "thigh_*" → thigh_l / thigh_r. */
export type SidedBone = "thigh_*" | "shank_*" | "foot_*" | "upperarm_*" | "forearm_*";

export const MUSCLES = {
  gluteus_maximus: {
    label: "Großer Gesäßmuskel",
    kind: "pair",
    origin: { bone: "pelvis", offset: [-9, 0, 6] },
    insertion: { bone: "thigh_*", offset: [-5, -13, 1] },
    radius: 6.5,
  },
  gluteus_medius: {
    label: "Mittlerer Gesäßmuskel",
    kind: "pair",
    origin: { bone: "pelvis", offset: [-2, 6, 12] },
    insertion: { bone: "thigh_*", offset: [0, -5, 6] },
    radius: 4.5,
  },
  hip_flexors: {
    label: "Hüftbeuger",
    kind: "pair",
    origin: { bone: "spine_low", offset: [4, 2, 5] },
    insertion: { bone: "thigh_*", offset: [5, -9, -1] },
    radius: 3.5,
  },
  quadriceps: {
    label: "Quadrizeps",
    kind: "pair",
    origin: { bone: "pelvis", offset: [7, -6, 8] },
    insertion: { bone: "shank_*", offset: [6, -5, 0] },
    radius: 6.2,
  },
  hamstrings: {
    label: "Beinbeuger",
    kind: "pair",
    origin: { bone: "pelvis", offset: [-7, -9, 6] },
    insertion: { bone: "shank_*", offset: [-5, -6, 0] },
    radius: 5.3,
  },
  adductors: {
    label: "Adduktoren",
    kind: "pair",
    origin: { bone: "pelvis", offset: [3, -10, 2] },
    insertion: { bone: "thigh_*", offset: [0, -30, -5] },
    radius: 4.8,
  },
  gastrocnemius: {
    label: "Wadenmuskel (Gastrocnemius)",
    kind: "pair",
    origin: { bone: "thigh_*", offset: [-4, -41, 0] },
    insertion: { bone: "foot_*", offset: [-6, -2, 0] },
    radius: 4.6,
  },
  soleus: {
    label: "Schollenmuskel (Soleus)",
    kind: "pair",
    origin: { bone: "shank_*", offset: [-3, -13, 1.5] },
    insertion: { bone: "foot_*", offset: [-6, -2, 0] },
    radius: 3.6,
  },
  tibialis_anterior: {
    label: "Vorderer Schienbeinmuskel",
    kind: "pair",
    origin: { bone: "shank_*", offset: [3.5, -6, 1.5] },
    insertion: { bone: "foot_*", offset: [6, -4, -1] },
    radius: 2.4,
  },
  rectus_abdominis: {
    label: "Gerader Bauchmuskel",
    kind: "center",
    origin: { bone: "pelvis", offset: [9, -4, 0] },
    insertion: { bone: "spine_up", offset: [11, 9, 0] },
    radius: 5.5,
    flat: 0.55,
  },
  obliques: {
    label: "Schräge Bauchmuskeln",
    kind: "pair",
    origin: { bone: "pelvis", offset: [4, 5, 12] },
    insertion: { bone: "spine_up", offset: [6, 6, 12] },
    radius: 4,
    flat: 0.6,
  },
  erector_spinae: {
    label: "Rückenstrecker",
    kind: "pair",
    origin: { bone: "pelvis", offset: [-9, 2, 3] },
    insertion: { bone: "spine_up", offset: [-9, 16, 3] },
    radius: 3.8,
  },
  latissimus: {
    label: "Breiter Rückenmuskel",
    kind: "pair",
    origin: { bone: "spine_low", offset: [-7, 5, 6] },
    insertion: { bone: "upperarm_*", offset: [0, -6, -2.5] },
    radius: 5,
    flat: 0.6,
  },
  pectoralis: {
    label: "Großer Brustmuskel",
    kind: "pair",
    origin: { bone: "spine_up", offset: [11, 14, 4] },
    insertion: { bone: "upperarm_*", offset: [2.5, -5, 0] },
    radius: 5,
    flat: 0.6,
  },
  deltoid: {
    label: "Deltamuskel",
    kind: "pair",
    origin: { bone: "spine_up", offset: [0, 21, 17] },
    insertion: { bone: "upperarm_*", offset: [0, -12, 2] },
    radius: 4.5,
  },
  trapezius: {
    label: "Trapezmuskel",
    kind: "pair",
    origin: { bone: "neck", offset: [-3, 4, 0] },
    insertion: { bone: "spine_up", offset: [-5, 20, 14] },
    radius: 3.8,
    flat: 0.6,
  },
  triceps: {
    label: "Trizeps",
    kind: "pair",
    origin: { bone: "upperarm_*", offset: [-3, -3, 0] },
    insertion: { bone: "forearm_*", offset: [-3, 1, 0] },
    radius: 3.5,
  },
  biceps: {
    label: "Bizeps",
    kind: "pair",
    origin: { bone: "upperarm_*", offset: [3, -4, 0] },
    insertion: { bone: "forearm_*", offset: [2.5, -4, 0] },
    radius: 3.4,
  },
} as const satisfies Record<string, MuscleGeometry>;

export type MuscleId = keyof typeof MUSCLES;
export const MUSCLE_IDS = Object.keys(MUSCLES) as MuscleId[];

/** Muskel-Referenz in Daten: Katalog-ID, optional mit Seite (_l / _r). */
export const MUSCLE_REFS: string[] = MUSCLE_IDS.flatMap((id) =>
  MUSCLES[id].kind === "pair" ? [id, `${id}_l`, `${id}_r`] : [id],
);

export function muscleLabel(ref: string): string {
  const m = /^(.*?)(_l|_r)?$/.exec(ref)!;
  const base = MUSCLES[m[1] as MuscleId];
  if (!base) return ref;
  if (m[2] === "_l") return `${base.label} (links)`;
  if (m[2] === "_r") return `${base.label} (rechts)`;
  return base.label;
}
