/** Öffentliche Schnittstelle des 3D-Formats (2.0). */
export * from "./schema";
export { MUSCLES, MUSCLE_IDS, MUSCLE_REFS, muscleLabel, type MuscleId } from "./muscles";
export { JOINTS, JOINT_LABEL, JOINT_NAMES, CONTACT_POINTS, CONTACT_POINT_NAMES, DIMS } from "./skeleton";
export { cycleDuration, poseAt, solvePose, timelineAt3d, ease } from "./kinematics";
export { buildScene, type Primitive, type MusclePrim, type Capsule, type Ellipsoid, type Scene3d } from "./scene";
export {
  renderPose3dSvg,
  renderHero3dSvg,
  renderThumb3dSvg,
  renderFrame3dSvg,
  renderFault3dSvg,
  heroKeyframe,
} from "./svg";
export { validateExercise3d, CONTACT_TOLERANCE_CM, MAX_IK_CORRECTION_CM, type PoseIssue } from "./validate";
