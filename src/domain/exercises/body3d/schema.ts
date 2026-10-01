import { z } from "zod";
import { exerciseIdSchema } from "../schema";
import { CONTACT_POINT_NAMES, JOINTS, type JointName } from "./skeleton";
import { MUSCLE_REFS } from "./muscles";

/**
 * Übungsformat 2.0 („3d“): Posen als Gelenkwinkel statt Bildpunkte.
 * Reine Daten – Zahlen, Enums, kurze Texte; alles endlich und begrenzt.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((s) => !CONTROL_CHARS.test(s), "Steuerzeichen nicht erlaubt");

const deg = z.number().finite().min(-180).max(180);
const cm = (min: number, max: number) => z.number().finite().min(min).max(max);

/** Gelenkwinkel je Gelenk; der Bewegungsumfang wird separat geprüft. */
const jointShape = Object.fromEntries(
  (Object.keys(JOINTS) as JointName[]).map((j) => [
    j,
    z
      .object(Object.fromEntries(Object.keys(JOINTS[j]).map((dof) => [dof, deg.optional()])))
      .strict()
      .optional(),
  ]),
);
export const jointAnglesSchema = z.object(jointShape).strict();
export type JointAngles = Partial<Record<JointName, Record<string, number | undefined>>>;

const surface = z.union([z.literal("floor"), z.string().regex(/^[a-z][a-z0-9_-]{0,23}$/)]);

export const contactsSchema = z
  .record(z.enum(CONTACT_POINT_NAMES as [string, ...string[]]), surface)
  .refine((r) => Object.keys(r).length <= 12, "höchstens 12 Kontakte");

const muscleRef = z.enum(MUSCLE_REFS as [string, ...string[]]);

export const activationSchema = z
  .record(muscleRef, z.number().finite().min(0).max(1))
  .refine((r) => Object.keys(r).length <= 16, "höchstens 16 Muskeln je Bild");

export const poseSchema3d = z
  .object({
    /** Körperlage über das Becken (Grad) – siehe Bauplan */
    joints: jointAnglesSchema,
    /** Horizontale Lage des Beckens (cm), Höhe ergibt sich aus den Kontakten */
    root: z.object({ x: cm(-150, 150).optional(), z: cm(-150, 150).optional(), y: cm(0, 220).optional() }).strict().optional(),
    contacts: contactsSchema,
    activation: activationSchema.optional(),
  })
  .strict();
export type Pose3d = z.infer<typeof poseSchema3d>;

export const keyframeSchema = poseSchema3d
  .extend({
    label: text(80),
    /** Zeit von diesem Bild zum nächsten (s) */
    toNextSec: z.number().finite().min(0.2).max(60),
    /** Haltezeit, wenn dieses Bild erreicht ist (s) */
    holdSec: z.number().finite().min(0).max(60),
  })
  .strict();
export type Keyframe3d = z.infer<typeof keyframeSchema>;

export const propSchema3d = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("box"),
      id: z.string().regex(/^[a-z][a-z0-9_-]{0,23}$/),
      /** Mitte der Box (cm) */
      x: cm(-200, 200),
      z: cm(-200, 200).optional(),
      /** Ausdehnung entlang x, z und Höhe (cm) */
      w: cm(5, 250),
      d: cm(5, 250).optional(),
      h: cm(2, 150),
    })
    .strict(),
  z
    .object({
      type: z.literal("wall"),
      id: z.string().regex(/^[a-z][a-z0-9_-]{0,23}$/),
      /** Wandfläche bei x (cm) */
      x: cm(-200, 200),
    })
    .strict(),
  z.object({ type: z.literal("kettlebell"), hand: z.enum(["left", "right"]), kg: cm(1, 64).optional() }).strict(),
  z
    .object({
      type: z.literal("band"),
      from: z.tuple([cm(-200, 200), cm(0, 220), cm(-200, 200)]),
      to: z.enum(["left_knee", "right_knee", "left_hand", "right_hand", "left_ankle", "right_ankle"]),
    })
    .strict(),
  z.object({ type: z.literal("mat") }).strict(),
]);
export type Prop3d = z.infer<typeof propSchema3d>;

export const VIEWS = ["side", "front", "back", "three_quarter", "top"] as const;
export type View3d = (typeof VIEWS)[number];

export const exercise3dDefinitionSchema = z
  .object({
    format: z.literal("3d"),
    id: exerciseIdSchema,
    title: text(80),
    subtitle: text(120),
    category: z.enum(["strength", "mobility"]),
    why: text(500),
    steps: z.array(text(300)).min(1).max(8),
    mistakes: z.array(text(200)).max(6),
    dose: text(120),
    progression: text(300),
    tempoText: text(160),
    view: z.enum(VIEWS),
    props: z.array(propSchema3d).max(8),
    muscles: z
      .array(
        z
          .object({
            id: muscleRef,
            role: z.enum(["work", "stretch", "stabilize"]),
            note: text(160),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    keyframes: z.array(keyframeSchema).min(2).max(6),
    /** Genau vier Bilder für den Ablauf; at = Position im Bildablauf (0 … Anzahl Schlüsselbilder, ohne diese; z. B. 1.5 = Rückweg von Bild 1 zu Bild 0) */
    frames: z.array(z.object({ at: z.number().finite().min(0).max(5), label: text(80) }).strict()).length(4),
    fault: z.object({ pose: poseSchema3d, caption: text(120) }).strict().nullable(),
  })
  .strict()
  .superRefine((d, ctx) => {
    const ids = new Set<string>();
    for (const [i, p] of d.props.entries()) {
      if ("id" in p) {
        if (ids.has(p.id)) ctx.addIssue({ code: "custom", message: `Requisit-ID "${p.id}" doppelt`, path: ["props", i, "id"] });
        ids.add(p.id);
      }
    }
    const checkSurfaces = (contacts: Record<string, string>, path: (string | number)[]) => {
      for (const [k, s] of Object.entries(contacts))
        if (s !== "floor" && !ids.has(s))
          ctx.addIssue({ code: "custom", message: `Kontakt ${k}: Fläche "${s}" gibt es nicht (floor oder eine Requisit-ID)`, path: [...path, k] });
    };
    d.keyframes.forEach((k, i) => checkSurfaces(k.contacts, ["keyframes", i, "contacts"]));
    if (d.fault) checkSurfaces(d.fault.pose.contacts, ["fault", "pose", "contacts"]);
    for (const [i, f] of d.frames.entries())
      if (f.at >= d.keyframes.length)
        ctx.addIssue({ code: "custom", message: `frames[${i}].at muss kleiner als die Anzahl der Schlüsselbilder sein (Rückweg: zwischen letztem und erstem Bild)`, path: ["frames", i, "at"] });
  });

export type Exercise3dDefinition = z.infer<typeof exercise3dDefinitionSchema>;
