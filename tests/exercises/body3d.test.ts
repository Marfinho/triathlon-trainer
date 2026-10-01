import { describe, it, expect } from "vitest";
import {
  builtin3dExercises,
  getBuiltinExercise,
  getLibraryExercise,
  libraryExercises,
  __loadLibrary3dForTest,
} from "@/domain/exercises/library";
import {
  cycleDuration,
  exercise3dDefinitionSchema,
  poseAt,
  renderFault3dSvg,
  renderFrame3dSvg,
  renderHero3dSvg,
  renderPose3dSvg,
  renderThumb3dSvg,
  solvePose,
  timelineAt3d,
  validateExercise3d,
  type Exercise3dDefinition,
} from "@/domain/exercises/body3d";
import { forwardKinematics } from "@/domain/exercises/body3d/kinematics";
import { buildScene } from "@/domain/exercises/body3d/scene";
import { vlen, vsub } from "@/domain/exercises/body3d/math";
import { DIMS } from "@/domain/exercises/body3d/skeleton";
import { anyExerciseDefinitionsSchema, isExercise3d, musclesOf, parseAnyDefinition } from "@/domain/exercises/any";
import { estimateExerciseDurationSec } from "@/domain/exercises/duration";
import { EXERCISE_3D_GUIDE } from "@/domain/exercises/body3d/guide";

const bridge = () => structuredClone(getLibraryExercise("glute-bridge")) as Exercise3dDefinition;

describe("3D-Bibliothek", () => {
  it("lädt die Prototyp-Übungen fehler- und warnungsfrei", () => {
    expect(builtin3dExercises.map((e) => e.id).sort()).toEqual(["bulgarian-split-squat", "glute-bridge", "side-plank"]);
    for (const def of builtin3dExercises) {
      const v = validateExercise3d(def);
      expect(v.errors, def.id).toEqual([]);
      expect(v.warnings, def.id).toEqual([]);
    }
  });

  it("ersetzt 2D-Fassungen gleicher ID, die 2D-Bibliothek bleibt erhalten", () => {
    expect(libraryExercises).toHaveLength(20);
    expect(isExercise3d(getLibraryExercise("glute-bridge")!)).toBe(true);
    expect(isExercise3d(getLibraryExercise("plank")!)).toBe(false);
    expect(getBuiltinExercise("glute-bridge")).not.toBeNull();
    expect(isExercise3d(getBuiltinExercise("glute-bridge")! as never)).toBe(false);
  });

  it("lehnt eine fachlich falsche Übung beim Laden laut ab", () => {
    const bad = bridge();
    bad.keyframes[0].joints.knee_l = { flex: 175 };
    expect(() => __loadLibrary3dForTest([bad])).toThrow(/Knie links/);
  });
});

describe("Kinematik", () => {
  it("Neutralstellung: Kopf oben, Füße am Boden", () => {
    const s = solvePose({ joints: {}, contacts: { left_heel: "floor", right_heel: "floor" } }, []);
    expect(s.frames.neck.origin[1]).toBeGreaterThan(140);
    expect(s.contacts.every((c) => Math.abs(c.residual) < 0.5)).toBe(true);
  });

  it("Knochenlängen bleiben bei beliebigen Winkeln erhalten", () => {
    const f = forwardKinematics(
      { hip_r: { flex: 70, abd: 20, rot: 30 }, knee_r: { flex: 100 }, shoulder_l: { flex: 120, abd: 40 }, elbow_l: { flex: 60 }, pelvis: { pitch: 35, roll: 10, yaw: -20 } },
      [0, 100, 0],
    );
    expect(vlen(vsub(f.shank_r.origin, f.thigh_r.origin))).toBeCloseTo(DIMS.thigh, 6);
    expect(vlen(vsub(f.foot_r.origin, f.shank_r.origin))).toBeCloseTo(DIMS.shank, 6);
    expect(vlen(vsub(f.forearm_l.origin, f.upperarm_l.origin))).toBeCloseTo(DIMS.upperArm, 6);
  });

  it("Vorzeichen: Hüftbeugung bringt das Knie nach vorn, Abduktion nach außen", () => {
    const f = forwardKinematics({ hip_r: { flex: 90 }, hip_l: { abd: 30 } }, [0, 100, 0]);
    expect(f.shank_r.origin[0]).toBeGreaterThan(40);
    expect(f.shank_l.origin[2]).toBeLessThan(-20);
  });

  it("ist deterministisch", () => {
    const def = bridge();
    expect(renderHero3dSvg(def)).toBe(renderHero3dSvg(bridge()));
    expect(JSON.stringify(buildScene(def, def.keyframes[1]))).toBe(JSON.stringify(buildScene(def, def.keyframes[1])));
  });

  it("Muskeln verkürzen sich bei Arbeit (Gesäß in der Brücke kürzer als in Rückenlage)", () => {
    const def = bridge();
    const len = (i: number) =>
      buildScene(def, def.keyframes[i]).primitives.find((p) => p.id === "gluteus_maximus_r")!;
    const a = len(0),
      b = len(1);
    if (a.kind !== "muscle" || b.kind !== "muscle") throw new Error("kein Muskel");
    expect(b.stretch).toBeLessThan(a.stretch);
  });
});

describe("Zeitachse", () => {
  it("läuft 0 → 1 → 0 mit Haltezeiten", () => {
    const def = bridge();
    const total = cycleDuration(def);
    expect(total).toBeCloseTo(def.keyframes.reduce((s, k) => s + k.toNextSec + k.holdSec, 0));
    expect(timelineAt3d(def, 0).at).toBe(0);
    const reached = timelineAt3d(def, def.keyframes[0].toNextSec + 0.01);
    expect(reached.at).toBe(1);
    expect(reached.holding).toBe(def.keyframes[1].holdSec > 0);
    expect(timelineAt3d(def, total + 0.001).at).toBeCloseTo(0, 2);
  });

  it("Zwischenpose mischt Winkel", () => {
    const def = bridge();
    const mid = poseAt(def, 0.5);
    const a = def.keyframes[0].joints.pelvis!.pitch!,
      b = def.keyframes[1].joints.pelvis!.pitch!;
    expect(mid.joints.pelvis!.pitch).toBeCloseTo((a + b) / 2);
  });

  it("Dauerschätzung nutzt den 3D-Ablauf", () => {
    const def = bridge();
    const est = estimateExerciseDurationSec({ sets: 2, reps: 10, holdSec: null, restSec: 60, perSide: false }, def);
    expect(est).toBe(Math.round(2 * 10 * cycleDuration(def) + 60));
  });
});

describe("Prüfung (validateExercise3d)", () => {
  it("Gelenk außerhalb des Bereichs → EXERCISE_POSE_INVALID mit Pfad", () => {
    const def = bridge();
    def.keyframes[1].joints.knee_r = { flex: 170 };
    const { errors } = validateExercise3d(def);
    expect(errors.some((e) => e.code === "EXERCISE_POSE_INVALID" && e.path === "keyframes[1].joints.knee_r.flex")).toBe(true);
  });

  it("Kontakt passt nicht zu den Winkeln → Fehler", () => {
    const def = bridge();
    def.keyframes[0].joints.pelvis = { pitch: 0 }; // stehend, aber Rücken soll am Boden liegen
    const { errors } = validateExercise3d(def);
    expect(errors.some((e) => e.path.startsWith("keyframes[0]"))).toBe(true);
  });

  it("Aktivierung eines nicht beschriebenen Muskels → Fehler", () => {
    const def = bridge();
    def.keyframes[0].activation = { ...def.keyframes[0].activation, biceps: 0.5 };
    const { errors } = validateExercise3d(def);
    expect(errors.some((e) => e.path === "keyframes[0].activation.biceps")).toBe(true);
  });

  it("zu ähnliche Schlüsselbilder → Fehler", () => {
    const def = bridge();
    def.keyframes[1] = { ...structuredClone(def.keyframes[0]), label: "gleich" };
    expect(validateExercise3d(def).errors.some((e) => e.path === "keyframes")).toBe(true);
  });
});

describe("Schema 2.0", () => {
  it("ist strikt: unbekannte Felder, Gelenke und Flächen werden abgelehnt", () => {
    const extra = { ...bridge(), svg: "<svg/>" };
    expect(exercise3dDefinitionSchema.safeParse(extra).success).toBe(false);
    const joint = bridge();
    (joint.keyframes[0].joints as Record<string, unknown>).tail = { flex: 10 };
    expect(exercise3dDefinitionSchema.safeParse(joint).success).toBe(false);
    const surf = bridge();
    surf.keyframes[0].contacts = { ...surf.keyframes[0].contacts, upper_back: "sofa" };
    expect(exercise3dDefinitionSchema.safeParse(surf).success).toBe(false);
    const frames = bridge();
    frames.frames[0].at = 2;
    expect(exercise3dDefinitionSchema.safeParse(frames).success).toBe(false);
  });

  it("lehnt Steuerzeichen und zu große Zahlen ab", () => {
    const t = bridge();
    t.title = "Brücke\u0007";
    expect(exercise3dDefinitionSchema.safeParse(t).success).toBe(false);
    const n = bridge();
    n.keyframes[0].joints.hip_l = { flex: 1e9 };
    expect(exercise3dDefinitionSchema.safeParse(n).success).toBe(false);
  });

  it("parseAnyDefinition wählt das Format anhand von format", () => {
    const r3 = parseAnyDefinition(bridge());
    expect(r3.success && isExercise3d(r3.data)).toBe(true);
    const r1 = parseAnyDefinition(getBuiltinExercise("plank"));
    expect(r1.success && !isExercise3d(r1.data)).toBe(true);
  });

  it("Plan-Schema liefert die Meldung des passenden Formats", () => {
    const def = bridge();
    def.keyframes[0].toNextSec = 0;
    const r = anyExerciseDefinitionsSchema.safeParse([def]);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path.join(".")).toBe("0.keyframes.0.toNextSec");
  });

  it("musclesOf liefert Klartext und Rollen", () => {
    const m = musclesOf(getLibraryExercise("side-plank")!);
    expect(m[0]).toMatchObject({ label: "Schräge Bauchmuskeln (rechts)", role: "work" });
  });
});

describe("Flache SVG-Darstellung", () => {
  it("liefert für alle 3D-Übungen gültige Bilder ohne NaN", () => {
    for (const def of builtin3dExercises) {
      const svgs = [renderHero3dSvg(def), renderThumb3dSvg(def), renderFault3dSvg(def) ?? "", ...[0, 1, 2, 3].map((i) => renderFrame3dSvg(def, i))];
      for (const s of svgs) {
        expect(s).not.toMatch(/NaN|Infinity|undefined/);
        if (s) expect(s.startsWith("<svg")).toBe(true);
      }
      expect(renderPose3dSvg(def, def.keyframes[0], { mode: "muscles", label: "x" })).toContain('class="b3m');
    }
  });

  it("escaped Texte aus der Definition", () => {
    const def = bridge();
    def.title = '<script>alert(1)</script> & "x"';
    const svg = renderHero3dSvg(def);
    expect(svg).not.toContain("<script");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("Muskelbild nummeriert jeden beschriebenen Muskel", () => {
    const def = bridge();
    const svg = renderHero3dSvg(def);
    expect((svg.match(/class="mk-c/g) ?? []).length).toBe(def.muscles.length);
  });
});

describe("KI-Bauplan", () => {
  it("nennt Gelenke mit Bereichen, Kontakte, Muskeln und Prüfregeln", () => {
    expect(EXERCISE_3D_GUIDE).toContain("knee_l / knee_r");
    expect(EXERCISE_3D_GUIDE).toContain("flex 0…155°");
    expect(EXERCISE_3D_GUIDE).toContain("left_heel");
    expect(EXERCISE_3D_GUIDE).toContain("gluteus_maximus (Großer Gesäßmuskel");
    expect(EXERCISE_3D_GUIDE).toContain("EXERCISE_POSE_INVALID");
  });
});
