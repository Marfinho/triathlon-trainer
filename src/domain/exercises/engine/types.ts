/**
 * Interne Engine-Form (Kürzel wie in der Referenz-Engine). Die öffentliche API
 * nimmt das Bibliotheksformat (`ExerciseDefinition`); `adapter.ts` übersetzt.
 */
export type Vec = [number, number];

/** [Winkel, Zehenwinkel|null, Richtung, flip (1/0)] */
export type EngineFoot = [number, number | null, number, number];

export interface EngineLimb {
  root: "P" | "N";
  /** [Ziel, bend, l1, l2] */
  ik?: [Vec, number, number, number];
  pts?: Vec[];
  foot: EngineFoot | null;
  m: string[];
}

export interface EnginePose {
  P: Vec;
  N?: Vec;
  lean?: number;
  H?: Vec;
  hd?: number;
  spine?: [Vec, Vec, Vec];
  noff?: boolean;
  tm?: string[];
  far: EngineLimb[];
  near: EngineLimb[];
  back?: string;
  extra?: string;
  kb?: { arm: number; off: Vec };
  band?: { from: Vec; limb: number };
}

/** Ergebnis von `mixPose`: vollständig aufgelöste Pose. */
export interface MixedPose {
  P: Vec;
  N: Vec;
  H: Vec;
  far: EngineLimb[];
  near: EngineLimb[];
  back: string;
  kb?: { arm: number; off: Vec };
  band?: { from: Vec; limb: number };
  tm: string[];
  noff?: boolean;
  spine?: Vec[];
}

export interface EngineMuscle {
  key: string;
  label: string;
  note: string;
  lv: number;
  kind: string;
}

export interface EngineExercise {
  id: string;
  title: string;
  S: EnginePose;
  T: EnginePose;
  F: EnginePose | null;
  faultCap: string | null;
  muscles: EngineMuscle[];
  /** [t, Label] */
  frames: [number, string][];
  /** [zum Ende, Halten am Ende, zurück, Halten am Start] */
  tempo: [number, number, number, number];
}
