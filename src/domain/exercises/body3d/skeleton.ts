import type { V3 } from "./math";

/**
 * Standard-Skelett (cm), angepasst an das Körpermodell (Blender „Human Base
 * Meshes“, CC0, auf 175 cm skaliert). Neutralstellung: aufrecht stehend,
 * Blick nach +x, Arme hängen seitlich, Füße flach.
 * Seitenvorzeichen s: links = −1 (z negativ), rechts = +1.
 */

export const DIMS = {
  pelvisHeight: 96.4,
  lumbar: 10,
  thoracic: 16,
  neckBase: 29.4,
  head: [4, 11.2, 0] as V3,
  hip: [0, -7, 9.4] as V3, // z wird mit s multipliziert
  shoulder: [-1, 15.6, 18] as V3, // relativ zum Brustwirbel-Gelenk, z mit s
  thigh: 40.2,
  shank: 41.9,
  upperArm: 27.6,
  forearm: 22.7,
  hand: 19,
  heel: [-6, -7.8, 0] as V3,
  ball: [12.5, -7.8, 0] as V3,
  toe: [18, -6.8, 0] as V3,
} as const;

/** Gelenke mit ihren Freiheitsgraden und Bewegungsumfang (Grad). */
export const JOINTS = {
  pelvis: { pitch: [-180, 180], roll: [-180, 180], yaw: [-180, 180] },
  spine_low: { flex: [-25, 50], lateral: [-30, 30], rot: [-30, 30] },
  spine_up: { flex: [-25, 45], lateral: [-30, 30], rot: [-40, 40] },
  neck: { flex: [-60, 70], lateral: [-40, 40], rot: [-70, 70] },
  hip_l: { flex: [-30, 130], abd: [-30, 60], rot: [-45, 50] },
  hip_r: { flex: [-30, 130], abd: [-30, 60], rot: [-45, 50] },
  knee_l: { flex: [0, 155] },
  knee_r: { flex: [0, 155] },
  ankle_l: { dorsi: [-55, 35] },
  ankle_r: { dorsi: [-55, 35] },
  shoulder_l: { flex: [-60, 180], abd: [-30, 180], rot: [-90, 90] },
  shoulder_r: { flex: [-60, 180], abd: [-30, 180], rot: [-90, 90] },
  elbow_l: { flex: [0, 150] },
  elbow_r: { flex: [0, 150] },
} as const;

export type JointName = keyof typeof JOINTS;
export const JOINT_NAMES = Object.keys(JOINTS) as JointName[];

/** Deutsche Namen für Fehlermeldungen. */
export const JOINT_LABEL: Record<JointName, string> = {
  pelvis: "Becken",
  spine_low: "untere Wirbelsäule",
  spine_up: "obere Wirbelsäule",
  neck: "Hals",
  hip_l: "Hüfte links",
  hip_r: "Hüfte rechts",
  knee_l: "Knie links",
  knee_r: "Knie rechts",
  ankle_l: "Sprunggelenk links",
  ankle_r: "Sprunggelenk rechts",
  shoulder_l: "Schulter links",
  shoulder_r: "Schulter rechts",
  elbow_l: "Ellbogen links",
  elbow_r: "Ellbogen rechts",
};

/** Knochen (Frames), an denen Kontaktpunkte und Muskeln hängen. */
export type BoneName =
  | "pelvis"
  | "spine_low"
  | "spine_up"
  | "neck"
  | "thigh_l"
  | "thigh_r"
  | "shank_l"
  | "shank_r"
  | "foot_l"
  | "foot_r"
  | "upperarm_l"
  | "upperarm_r"
  | "forearm_l"
  | "forearm_r";

/**
 * Kontaktpunkte: Punkt im Knochen-Frame + Abstand Punkt → Haut (cm).
 * Ziel bei Bodenkontakt: Punkt.y = Fläche + radius.
 */
export const CONTACT_POINTS = {
  left_heel: { bone: "foot_l", offset: [-6, -7.8, 0], radius: 0 },
  right_heel: { bone: "foot_r", offset: [-6, -7.8, 0], radius: 0 },
  left_ball: { bone: "foot_l", offset: [12.5, -7.8, 0], radius: 0 },
  right_ball: { bone: "foot_r", offset: [12.5, -7.8, 0], radius: 0 },
  left_toes: { bone: "foot_l", offset: [18, -6.8, 0], radius: 1 },
  right_toes: { bone: "foot_r", offset: [18, -6.8, 0], radius: 1 },
  left_instep: { bone: "foot_l", offset: [8, -2, 0], radius: 3 },
  right_instep: { bone: "foot_r", offset: [8, -2, 0], radius: 3 },
  left_foot_side: { bone: "foot_l", offset: [5, -5.5, 0], radius: 4.5 },
  right_foot_side: { bone: "foot_r", offset: [5, -5.5, 0], radius: 4.5 },
  left_knee: { bone: "shank_l", offset: [0, 0, 0], radius: 6 },
  right_knee: { bone: "shank_r", offset: [0, 0, 0], radius: 6 },
  left_hand: { bone: "forearm_l", offset: [0, -31, 0], radius: 2 },
  right_hand: { bone: "forearm_r", offset: [0, -31, 0], radius: 2 },
  left_elbow: { bone: "forearm_l", offset: [0, 0, 0], radius: 4 },
  right_elbow: { bone: "forearm_r", offset: [0, 0, 0], radius: 4 },
  left_wrist: { bone: "forearm_l", offset: [0, -22.7, 0], radius: 3 },
  right_wrist: { bone: "forearm_r", offset: [0, -22.7, 0], radius: 3 },
  pelvis: { bone: "pelvis", offset: [0, 0, 0], radius: 11 },
  left_hip_side: { bone: "pelvis", offset: [0, -4, -9], radius: 9 },
  right_hip_side: { bone: "pelvis", offset: [0, -4, 9], radius: 9 },
  upper_back: { bone: "spine_up", offset: [0, 6, 0], radius: 11 },
  head_back: { bone: "neck", offset: [4, 11.2, 0], radius: 10 },
} as const satisfies Record<string, { bone: BoneName; offset: readonly number[]; radius: number }>;

export type ContactPointName = keyof typeof CONTACT_POINTS;
export const CONTACT_POINT_NAMES = Object.keys(CONTACT_POINTS) as ContactPointName[];

/** Kontaktpunkte, die über die Beine bzw. Arme per IK nachgeführt werden. */
export const IK_CONTACTS: Partial<Record<ContactPointName, { chain: "leg" | "arm"; side: "l" | "r" }>> = {
  left_heel: { chain: "leg", side: "l" },
  right_heel: { chain: "leg", side: "r" },
  left_ball: { chain: "leg", side: "l" },
  right_ball: { chain: "leg", side: "r" },
  left_toes: { chain: "leg", side: "l" },
  right_toes: { chain: "leg", side: "r" },
  left_instep: { chain: "leg", side: "l" },
  right_instep: { chain: "leg", side: "r" },
  left_foot_side: { chain: "leg", side: "l" },
  right_foot_side: { chain: "leg", side: "r" },
  left_hand: { chain: "arm", side: "l" },
  right_hand: { chain: "arm", side: "r" },
};
