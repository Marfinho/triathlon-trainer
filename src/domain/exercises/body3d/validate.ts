import { CONTACT_POINTS, JOINTS, JOINT_LABEL, type BoneName, type JointName } from "./skeleton";
import { boneToWorld, poseAt, solvePose, type BodyFrames } from "./kinematics";
import type { Exercise3dDefinition, Pose3d } from "./schema";
import { muscleLabel } from "./muscles";

/**
 * Fachliche Prüfung einer 3D-Übung (nach dem Zod-Schema). Liefert konkrete,
 * für eine KI verständliche Meldungen mit Pfad – z. B. „Knie links 175° liegt
 * außerhalb 0–155°“.
 */
export interface PoseIssue {
  code: "EXERCISE_POSE_INVALID" | "EXERCISE_POSE_WARNING";
  message: string;
  path: string;
}

/** Erlaubte Restabweichung eines Kontakts (cm). */
export const CONTACT_TOLERANCE_CM = 3;
/** Größte automatische IK-Korrektur (cm), darüber passen die Winkel nicht. */
export const MAX_IK_CORRECTION_CM = 12;

const SAMPLE_BONES: BoneName[] = [
  "pelvis",
  "spine_low",
  "spine_up",
  "neck",
  "thigh_l",
  "thigh_r",
  "shank_l",
  "shank_r",
  "foot_l",
  "foot_r",
  "upperarm_l",
  "upperarm_r",
  "forearm_l",
  "forearm_r",
];

/** Tiefster Körperpunkt (Gelenkmitten + Kopf + Hände, cm über dem Boden). */
export function lowestJoint(frames: BodyFrames): { bone: string; y: number } {
  let best = { bone: "pelvis", y: Infinity };
  const check = (bone: string, y: number) => {
    if (y < best.y) best = { bone, y };
  };
  for (const b of SAMPLE_BONES) check(b, frames[b].origin[1]);
  check("head", boneToWorld(frames, "neck", [2, 13, 0])[1]);
  check("hand_l", boneToWorld(frames, "forearm_l", [0, -34, 0])[1]);
  check("hand_r", boneToWorld(frames, "forearm_r", [0, -34, 0])[1]);
  return best;
}

function checkPose(def: Exercise3dDefinition, pose: Pose3d, path: string, out: PoseIssue[]) {
  // Bewegungsumfang
  for (const [joint, dofs] of Object.entries(pose.joints) as [JointName, Record<string, number | undefined>][]) {
    for (const [dof, value] of Object.entries(dofs ?? {})) {
      if (value === undefined) continue;
      const range = (JOINTS[joint] as Record<string, readonly [number, number]>)[dof];
      if (range && (value < range[0] || value > range[1]))
        out.push({
          code: "EXERCISE_POSE_INVALID",
          message: `${JOINT_LABEL[joint]} ${dof} ${value}° liegt außerhalb ${range[0]}…${range[1]}°.`,
          path: `${path}.joints.${joint}.${dof}`,
        });
    }
  }
  // Muskeln an der Pose müssen beschrieben sein
  const described = new Set(def.muscles.map((m) => m.id.replace(/_[lr]$/, "")));
  for (const k of Object.keys(pose.activation ?? {}))
    if (!described.has(k.replace(/_[lr]$/, "")))
      out.push({
        code: "EXERCISE_POSE_INVALID",
        message: `Aktivierung für „${muscleLabel(k)}“, der Muskel steht aber nicht in muscles[].`,
        path: `${path}.activation.${k}`,
      });

  const solved = solvePose(pose, def.props);
  for (const c of solved.contacts)
    if (Math.abs(c.residual) > CONTACT_TOLERANCE_CM)
      out.push({
        code: "EXERCISE_POSE_INVALID",
        message: `Kontakt ${c.point} → ${c.surface}: ${c.residual > 0 ? "schwebt" : "steckt"} ${Math.abs(c.residual).toFixed(1)} cm ${c.residual > 0 ? "über" : "in"} der Fläche. Winkel anpassen.`,
        path: `${path}.contacts.${c.point}`,
      });
  if (solved.ikCorrection > MAX_IK_CORRECTION_CM)
    out.push({
      code: "EXERCISE_POSE_INVALID",
      message: `Hände/Füße mussten ${solved.ikCorrection.toFixed(0)} cm nachgeführt werden (max. ${MAX_IK_CORRECTION_CM}). Die Gelenkwinkel passen nicht zu den Kontakten.`,
      path: `${path}.joints`,
    });
  const low = lowestJoint(solved.frames);
  if (low.y < 0)
    out.push({
      code: "EXERCISE_POSE_INVALID",
      message: `Körperteil ${low.bone} liegt ${(-low.y).toFixed(0)} cm unter dem Boden.`,
      path: `${path}.joints`,
    });

  // Schwerpunkt (nur Hinweis): grob über Gelenkmitten gegen die Stützpunkte
  const pts = Object.keys(pose.contacts).map((k) =>
    boneToWorld(solved.frames, CONTACT_POINTS[k as keyof typeof CONTACT_POINTS].bone, CONTACT_POINTS[k as keyof typeof CONTACT_POINTS].offset),
  );
  if (pts.length > 0 && !Object.values(pose.contacts).some((s) => s !== "floor")) {
    const com = SAMPLE_BONES.map((b) => solved.frames[b].origin).reduce(
      (a, p) => [a[0] + p[0] / SAMPLE_BONES.length, 0, a[2] + p[2] / SAMPLE_BONES.length],
      [0, 0, 0],
    );
    const minX = Math.min(...pts.map((p) => p[0])) - 10,
      maxX = Math.max(...pts.map((p) => p[0])) + 10,
      minZ = Math.min(...pts.map((p) => p[2])) - 10,
      maxZ = Math.max(...pts.map((p) => p[2])) + 10;
    if (com[0] < minX || com[0] > maxX || com[2] < minZ || com[2] > maxZ)
      out.push({
        code: "EXERCISE_POSE_WARNING",
        message: "Der Körperschwerpunkt liegt außerhalb der Stützfläche – kippt die Figur?",
        path,
      });
  }
}

export function validateExercise3d(def: Exercise3dDefinition): { errors: PoseIssue[]; warnings: PoseIssue[] } {
  const all: PoseIssue[] = [];
  def.keyframes.forEach((k, i) => checkPose(def, k, `keyframes[${i}]`, all));
  if (def.fault) checkPose(def, def.fault.pose, "fault.pose", all);

  // Bewegung muss sichtbar sein
  const maxDiff = (() => {
    let m = 0;
    for (let i = 1; i < def.keyframes.length; i++) {
      const a = def.keyframes[0].joints as Record<string, Record<string, number | undefined>>,
        b = def.keyframes[i].joints as Record<string, Record<string, number | undefined>>;
      for (const j of new Set([...Object.keys(a), ...Object.keys(b)]))
        for (const dof of new Set([...Object.keys(a[j] ?? {}), ...Object.keys(b[j] ?? {})]))
          m = Math.max(m, Math.abs((a[j]?.[dof] ?? 0) - (b[j]?.[dof] ?? 0)));
    }
    return m;
  })();
  if (maxDiff < 5)
    all.push({
      code: "EXERCISE_POSE_INVALID",
      message: "Die Schlüsselbilder unterscheiden sich kaum (< 5°) – es ist keine Bewegung zu sehen.",
      path: "keyframes",
    });

  // Zwischenbilder: nichts taucht in den Boden
  for (let i = 0; i < def.keyframes.length; i++) {
    for (let s = 1; s < 4; s++) {
      const solved = solvePose(poseAt(def, i + s / 4), def.props);
      const low = lowestJoint(solved.frames);
      if (low.y < -3) {
        all.push({
          code: "EXERCISE_POSE_WARNING",
          message: `Zwischen Bild ${i + 1} und ${((i + 1) % def.keyframes.length) + 1} taucht ${low.bone} in den Boden.`,
          path: `keyframes[${i}]`,
        });
        break;
      }
    }
  }
  return {
    errors: all.filter((x) => x.code === "EXERCISE_POSE_INVALID"),
    warnings: all.filter((x) => x.code === "EXERCISE_POSE_WARNING"),
  };
}
