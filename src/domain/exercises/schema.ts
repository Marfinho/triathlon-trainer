import { z } from "zod";

/**
 * Übungsdefinitionen (Kraft & Mobility) und die Segment-Erweiterung von
 * `localhub_plan` 1.1.
 *
 * Leitplanken:
 *  - Definitionen sind reine Daten: Zahlen, Enums und kurze Texte. KEIN
 *    Roh-SVG, kein HTML, keine URLs. Gezeichnet wird ausschließlich durch die
 *    Engine (`./engine`), die alle Texte XML-escaped.
 *  - Alle Zahlen sind endlich und begrenzt, alle Arrays und Texte begrenzt,
 *    Steuerzeichen sind verboten. Nutzer- und LLM-Eingaben laufen immer durch
 *    diese Schemata.
 */

// ---------- Grundbausteine ----------
const coord = z.number().finite().min(-40).max(240);
const coordY = z.number().finite().min(-40).max(200);
/** Punkt [x, y] im Zeichenraum (viewBox 0 -20 200 170, Boden bei y = 136). */
export const pointSchema = z.tuple([coord, coordY]);
const angle = z.number().finite().min(-180).max(180);

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

/** Text ohne Steuerzeichen, begrenzt. */
const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((s) => !CONTROL_CHARS.test(s), "Steuerzeichen nicht erlaubt");

export const EXERCISE_ID_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const exerciseIdSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(EXERCISE_ID_REGEX, "nur Kleinbuchstaben, Ziffern und Bindestriche");

// ---------- Muskeln ----------
/** Muskelschlüssel, die an Gliedmaßen hängen. */
export const LIMB_MUSCLE_KEYS = [
  "quad",
  "ham",
  "vmo",
  "add",
  "calf",
  "sol",
  "ach",
  "tib",
  "pat",
  "glute",
  "hipfl",
  "glmed",
] as const;
/** Muskelschlüssel, die am Rumpf hängen. */
export const TORSO_MUSCLE_KEYS = ["core", "back", "obl", "chest"] as const;
export const MUSCLE_KEYS = [...LIMB_MUSCLE_KEYS, ...TORSO_MUSCLE_KEYS] as const;
export type MuscleKey = (typeof MUSCLE_KEYS)[number];
export type LimbMuscleKey = (typeof LIMB_MUSCLE_KEYS)[number];
export type TorsoMuscleKey = (typeof TORSO_MUSCLE_KEYS)[number];

export const muscleSchema = z.object({
  key: z.enum(MUSCLE_KEYS),
  label: text(80),
  note: text(160),
  /** 1 = Hauptarbeit, 2 = unterstützend */
  level: z.union([z.literal(1), z.literal(2)]),
  /** work = arbeitet (rot), stretch = wird gedehnt (blau) */
  kind: z.enum(["work", "stretch"]),
});
export type Muscle = z.infer<typeof muscleSchema>;

// ---------- Gliedmaßen ----------
export const footSchema = z.object({
  /** Winkel Ferse–Ballen in Grad; 0 = flach, positiv = Zehen nach unten */
  angle: angle,
  /** Winkel der Zehen; null = wie angle (starrer Fuß) */
  toeAngle: angle.nullable(),
  /** 1 = Zehen zeigen nach rechts, -1 = nach links */
  direction: z.union([z.literal(1), z.literal(-1)]),
  /** true = Sohle zeigt nach oben (Spann liegt auf) */
  flip: z.boolean(),
});
export type Foot = z.infer<typeof footSchema>;

export const limbSchema = z
  .object({
    /** hip = Bein (Ober-/Unterschenkel 30/30), neck = Arm (Ober-/Unterarm 20/18) */
    root: z.enum(["hip", "neck"]),
    /** Zielpunkt; das mittlere Gelenk wird per Zwei-Knochen-IK berechnet */
    ik: z
      .object({ end: pointSchema, bend: z.union([z.literal(1), z.literal(-1)]) })
      .optional(),
    /** Alternativ zwei feste Punkte [Gelenk, Ende] */
    points: z.tuple([pointSchema, pointSchema]).optional(),
    foot: footSchema.nullable(),
    muscles: z.array(z.enum(LIMB_MUSCLE_KEYS)).max(6),
  })
  .refine((l) => (l.ik ? 1 : 0) + (l.points ? 1 : 0) === 1, "genau eines von ik oder points angeben")
  .refine((l) => l.root === "hip" || l.foot === null, "Arme haben keinen Fuß");
export type Limb = z.infer<typeof limbSchema>;

// ---------- Requisiten und Beschriftungen ----------
export const propSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("box"),
    x: coord,
    y: coordY,
    w: z.number().finite().min(1).max(200),
    h: z.number().finite().min(1).max(160),
  }),
  z.object({ type: z.literal("wall"), x: coord, w: z.number().finite().min(2).max(40) }),
]);
export type Prop = z.infer<typeof propSchema>;

export const annotationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("arrow"),
    from: pointSchema,
    to: pointSchema,
    curve: pointSchema.optional(),
  }),
  z.object({ type: z.literal("guide"), from: pointSchema, to: pointSchema }),
  z.object({
    type: z.literal("label"),
    text: text(40),
    at: pointSchema,
    anchor: z.enum(["start", "middle", "end"]),
  }),
]);
export type Annotation = z.infer<typeof annotationSchema>;

// ---------- Pose ----------
export const poseSchema = z
  .object({
    hip: pointSchema,
    /** Schulter/Nackenansatz. Alternativ `lean` (Grad, 0 = aufrecht, positiv = nach vorn/rechts) */
    neck: pointSchema.optional(),
    lean: angle.optional(),
    head: pointSchema.optional(),
    headOffset: z.number().finite().min(0).max(30).optional(),
    /** Drei Stützpunkte einer Rumpfkurve (Hüfte, Kontrollpunkt, Schulter), z. B. Katze-Kuh */
    spine: z.tuple([pointSchema, pointSchema, pointSchema]).optional(),
    /** true = Frontalansicht: Muskelmarkierungen mittig statt seitlich versetzt */
    frontView: z.boolean(),
    torsoMuscles: z.array(z.enum(TORSO_MUSCLE_KEYS)).max(4),
    farLimbs: z.array(limbSchema).max(4),
    nearLimbs: z.array(limbSchema).max(4),
    props: z.array(propSchema).max(8),
    kettlebell: z
      .object({ nearLimb: z.number().int().min(0).max(3), offset: pointSchema })
      .optional(),
    band: z.object({ from: pointSchema, nearLimb: z.number().int().min(0).max(3) }).optional(),
    annotations: z.array(annotationSchema).max(12),
  })
  .superRefine((p, ctx) => {
    if (p.kettlebell && p.kettlebell.nearLimb >= p.nearLimbs.length)
      ctx.addIssue({
        code: "custom",
        message: "kettlebell.nearLimb verweist auf keine vorhandene Gliedmaße",
        path: ["kettlebell", "nearLimb"],
      });
    if (p.band && p.band.nearLimb >= p.nearLimbs.length)
      ctx.addIssue({
        code: "custom",
        message: "band.nearLimb verweist auf keine vorhandene Gliedmaße",
        path: ["band", "nearLimb"],
      });
  });
export type Pose = z.infer<typeof poseSchema>;

// ---------- Übungsdefinition ----------
const seconds = z.number().finite().min(0.2).max(60);

export const EXERCISE_CATEGORIES = ["strength", "mobility"] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const exerciseDefinitionSchema = z
  .object({
    id: exerciseIdSchema,
    title: text(80),
    subtitle: text(120),
    category: z.enum(EXERCISE_CATEGORIES),
    why: text(500),
    steps: z.array(text(300)).min(1).max(8),
    mistakes: z.array(text(200)).max(6),
    dose: text(120),
    progression: text(300),
    muscles: z.array(muscleSchema).min(1).max(6),
    start: poseSchema,
    end: poseSchema,
    fault: poseSchema.nullable(),
    faultCaption: text(120).nullable(),
    /** Genau vier Bilder für den Ablauf-Streifen; t = Position zwischen start (0) und end (1) */
    frames: z
      .array(z.object({ t: z.number().finite().min(0).max(1), label: text(80) }))
      .length(4),
    tempo: z.object({
      toEndSec: seconds,
      holdEndSec: seconds,
      toStartSec: seconds,
      holdStartSec: seconds,
    }),
    tempoText: text(160),
  })
  .superRefine((d, ctx) => {
    // Start und Ende müssen dieselbe Struktur haben, sonst ist keine Interpolation möglich.
    const shape = (p: Pose) => ({
      far: p.farLimbs.map((l) => `${l.root}:${l.ik ? "ik" : "pts"}`),
      near: p.nearLimbs.map((l) => `${l.root}:${l.ik ? "ik" : "pts"}`),
    });
    if (JSON.stringify(shape(d.start)) !== JSON.stringify(shape(d.end)))
      ctx.addIssue({
        code: "custom",
        message: "start und end brauchen dieselbe Gliedmaßen-Struktur (Anzahl, Wurzel, ik/points)",
        path: ["end"],
      });
    // Muskelschlüssel an Posen müssen in muscles[] beschrieben sein.
    const declared = new Set(d.muscles.map((m) => m.key));
    for (const [name, p] of [
      ["start", d.start],
      ["end", d.end],
    ] as const) {
      const used = [
        ...p.torsoMuscles,
        ...p.farLimbs.flatMap((l) => l.muscles),
        ...p.nearLimbs.flatMap((l) => l.muscles),
      ];
      for (const k of used)
        if (!declared.has(k))
          ctx.addIssue({
            code: "custom",
            message: `Muskel "${k}" ist an der Pose markiert, aber nicht in muscles[] beschrieben`,
            path: [name],
          });
    }
    if ((d.fault === null) !== (d.faultCaption === null))
      ctx.addIssue({
        code: "custom",
        message: "fault und faultCaption müssen zusammen gesetzt oder beide null sein",
        path: ["faultCaption"],
      });
  });
export type ExerciseDefinition = z.infer<typeof exerciseDefinitionSchema>;

// ---------- Plan-Erweiterung 1.1 ----------
/** Verweis in einem Plan-Segment auf eine Übung (Bibliothek oder exerciseDefinitions). */
export const segmentExerciseSchema = z
  .object({
    id: exerciseIdSchema,
    sets: z.number().int().min(1).max(20),
    reps: z.number().int().min(1).max(100).nullable().default(null),
    holdSec: z.number().int().min(1).max(600).nullable().default(null),
    restSec: z.number().int().min(0).max(600).nullable().default(null),
    /** true = Wiederholungen/Halten gelten pro Seite */
    perSide: z.boolean().default(false),
    loadKg: z.number().finite().min(0).max(500).nullable().default(null),
    note: z
      .string()
      .max(200)
      .refine((s) => !CONTROL_CHARS.test(s), "Steuerzeichen nicht erlaubt")
      .nullable()
      .default(null),
  })
  .refine((e) => e.reps !== null || e.holdSec !== null, "reps oder holdSec angeben");
export type SegmentExercise = z.infer<typeof segmentExerciseSchema>;

/** Höchstzahl eigener Übungsdefinitionen pro Plan. */
export const MAX_DEFINITIONS_PER_PLAN = 20;
export const exerciseDefinitionsSchema = z
  .array(exerciseDefinitionSchema)
  .max(MAX_DEFINITIONS_PER_PLAN);

/** Größenlimit für die Definitionen eines einzelnen Plans (Serialisierung in Bytes). */
export const MAX_DEFINITIONS_BYTES = 200_000;

/** Höchstzahl gespeicherter eigener Übungen pro Nutzer. */
export const MAX_CUSTOM_EXERCISES_PER_USER = 200;
