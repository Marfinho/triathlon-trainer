import { CONTACT_POINTS, DIMS, IK_CONTACTS, JOINTS, JOINT_LABEL, type JointName } from "./skeleton";
import { MUSCLES, MUSCLE_IDS } from "./muscles";
import { CONTACT_TOLERANCE_CM, MAX_IK_CORRECTION_CM } from "./validate";
import { VIEWS } from "./schema";

/**
 * KI-Bauplan für Übungen im 3D-Format (2.0). Tabellen (Gelenke, Kontakte,
 * Muskeln) werden aus denselben Daten erzeugt, die Engine und Prüfung
 * verwenden – der Bauplan kann deshalb nicht veralten.
 */

const DOF_MEANING: Record<string, Record<string, string>> = {
  pelvis: {
    pitch: "+ = Oberkörper kippt nach vorn (x+); +90 = Bauchlage/Stütz mit Kopf bei x+; −90 = Rückenlage mit Kopf bei x−",
    roll: "+ = kippt zur linken Seite (z−); −90 = Seitlage auf der rechten Seite (Kopf bei z+)",
    yaw: "+ = dreht nach links",
  },
  spine_low: { flex: "+ = rund nach vorn, − = Hohlkreuz", lateral: "+ = nach links neigen", rot: "+ = Brust dreht nach links" },
  spine_up: { flex: "+ = rund nach vorn, − = Brustwirbelsäule streckt", lateral: "+ = nach links neigen", rot: "+ = Brust dreht nach links" },
  neck: { flex: "+ = Kinn zur Brust", lateral: "+ = Kopf nach links neigen", rot: "+ = Blick nach links" },
  hip: { flex: "+ = Knie nach vorn/oben, − = Bein nach hinten (Streckung)", abd: "+ = Bein seitlich nach außen", rot: "+ = Außenrotation (Fußspitze nach außen)" },
  knee: { flex: "0 = gestreckt, + = gebeugt" },
  ankle: { dorsi: "+ = Zehen zum Schienbein, − = Spitzfuß / Ferse hoch" },
  shoulder: { flex: "+ = Arm nach vorn/oben (180 = über Kopf), − = nach hinten", abd: "+ = Arm seitlich nach außen/oben", rot: "+ = Außenrotation" },
  elbow: { flex: "0 = gestreckt, + = gebeugt (Unterarm nach vorn)" },
};

function jointTable(): string {
  return (Object.keys(JOINTS) as JointName[])
    .filter((j) => !j.endsWith("_l"))
    .map((j) => {
      const base = j.replace(/_r$/, "");
      const name = j.endsWith("_r") ? `${base}_l / ${base}_r` : j;
      const dofs = Object.entries(JOINTS[j] as Record<string, readonly [number, number]>)
        .map(([dof, [lo, hi]]) => `${dof} ${lo}…${hi}° (${DOF_MEANING[base]?.[dof] ?? ""})`)
        .join("; ");
      return `- ${name} – ${JOINT_LABEL[j].replace(/ rechts$/, "")}: ${dofs}`;
    })
    .join("\n");
}

function contactList(): string {
  const names = Object.keys(CONTACT_POINTS) as (keyof typeof CONTACT_POINTS)[];
  const ik = names.filter((n) => IK_CONTACTS[n]);
  const rigid = names.filter((n) => !IK_CONTACTS[n]);
  return `Hände/Füße (werden bis ${MAX_IK_CORRECTION_CM} cm nachgeführt): ${ik.join(", ")}\nKörperpunkte (nicht nachgeführt, Winkel müssen passen): ${rigid.join(", ")}`;
}

export function muscleCatalogText(): string {
  return MUSCLE_IDS.map((id) => `${id} (${MUSCLES[id].label}${MUSCLES[id].kind === "pair" ? ", _l/_r möglich" : ""})`).join(", ");
}

export const EXERCISE_3D_GUIDE = `ÜBUNGEN IM 3D-FORMAT – Bauplan (format "3d", für exerciseDefinitions[] mit schemaVersion "1.1" oder als einzelne Übung)

Grundidee: Du lieferst NUR Daten – Gelenkwinkel je Schlüsselbild, Kontakte, Muskeln. Die App baut daraus den 3D-Körper,
setzt ihn auf Boden/Requisiten, berechnet die Zwischenbilder und färbt die Muskeln. Kein SVG, kein HTML, keine URLs.

KOORDINATEN: cm. x = vorn (Blickrichtung in Neutralstellung), y = oben, z = rechts. Boden y = 0.
Neutralstellung (alle Winkel 0): aufrecht stehend, Arme hängen seitlich, Füße flach, Becken ${DIMS.pelvisHeight} cm hoch.
Segmentlängen: Oberschenkel ${DIMS.thigh}, Unterschenkel ${DIMS.shank}, Oberarm ${DIMS.upperArm}, Unterarm ${DIMS.forearm}, Rumpf (Becken→Halsansatz) ca. ${DIMS.lumbar + DIMS.thoracic + DIMS.neckBase}.
Nicht angegebene Winkel sind 0. Die Höhe des Körpers ergibt sich automatisch aus den Kontakten (root.y nicht setzen);
root.x / root.z verschieben das Becken waagerecht (z. B. Abstand zu Bank oder Wand).

GELENKE (Name: Freiheitsgrad Bereich (Bedeutung)) – Werte außerhalb sind ein Fehler:
${jointTable()}

KÖRPERLAGE ÜBER DAS BECKEN (pelvis):
- Stehen: pitch 0. Vorbeugen (Hinge): pitch +30…+70, Hüften dabei etwa gleich stark beugen (flex), damit die Beine senkrecht bleiben.
- Rückenlage: pitch −90 (Kopf bei x−). Brücke: pitch ca. −120 und Hüfte gestreckt.
- Bauchlage, Unterarmstütz, Vierfüßler: pitch +90 (Kopf bei x+, Blick zum Boden); Vierfüßler zusätzlich Hüfte flex 90, Knie 90, Schulter flex 90.
- Seitlage/Seitstütz auf der rechten Seite: roll −80…−90 (Kopf bei z+), dazu view "front".
- Merke: Gelenkwinkel sind relativ zum übergeordneten Körperteil. Liegt der Rumpf (pitch −90), heißt Hüfte flex 90 „Oberschenkel senkrecht nach oben“.

KONTAKTE: contacts { Punkt: "floor" | Requisit-ID } je Schlüsselbild. Jeder Kontakt muss nach dem Aufsetzen höchstens ${CONTACT_TOLERANCE_CM} cm
von der Fläche entfernt sein. Füße/Hände werden automatisch nachgeführt; ist dafür mehr als ${MAX_IK_CORRECTION_CM} cm nötig, passen die Winkel nicht.
Mindestens ein Kontakt pro Bild. Kein Körperteil darf unter dem Boden liegen.
${contactList()}

MUSKELN (Katalog-ID, Seite optional mit _l / _r):
${muscleCatalogText()}
muscles[1–8]: { id, role "work" (arbeitet, rot) | "stretch" (wird gedehnt, blau) | "stabilize" (hält, rot blass), note (kurz, warum) }.
activation je Schlüsselbild: { Muskel-ID: 0…1 } – wie stark er gerade arbeitet bzw. gedehnt wird. Nur Muskeln aus muscles[] verwenden.
Muskeln verkürzen und dehnen sich automatisch mit den Gelenkwinkeln – nur die Stärke gibst du vor.

ABLAUF:
- keyframes[2–6]: Schlüsselbilder mit joints, root?, contacts, activation?, label (Phase, z. B. „Hüfte hoch – Po fest“),
  toNextSec (Dauer bis zum nächsten Bild, 0,2–60) und holdSec (Haltezeit, wenn dieses Bild erreicht ist).
  Der Ablauf läuft 0 → 1 → … → letztes → 0. Typisch: 2 Bilder (Start, Ziel) mit z. B. toNextSec 2 (hoch) und 2,5 (runter).
- Halteübungen (Plank, Dehnung): trotzdem 2 Bilder mit kleiner, sichtbarer Bewegung (mind. 5° Unterschied), langes holdSec.
- frames: genau 4 { at, label } für den Ablauf in Bildern; at = Position im Ablauf (0 = Bild 0, 1 = Bild 1, 0,5 = halber Weg,
  1,5 = halber Rückweg bei zwei Bildern). at muss kleiner als die Anzahl der Schlüsselbilder sein.
- fault: häufigster Fehler als Pose { joints, contacts, activation? } + caption („Falsch: …“), sonst null.
- view: Kameraansicht für Standbilder: ${VIEWS.join(", ")}. Seitansicht "side" schaut von rechts (z+) auf die Figur, "front" von vorn (x+).
- props[]: { type:"box", id, x, z?, w, d?, h } (Bank/Stufe, Mitte x, Breite w entlang x, Höhe h), { type:"wall", id, x },
  { type:"mat" }, { type:"kettlebell", hand:"left"|"right", kg? }, { type:"band", from:[x,y,z], to:"left_knee"|… }.
  Kontakte auf Requisiten verwenden deren id als Fläche.

TEXTE (Deutsch, kurz): title, subtitle, category "strength"|"mobility", why, steps[1–8], mistakes[0–6], dose, progression, tempoText.
id: kebab-case, nicht aus dem Übungskatalog.

PRÜFUNG DURCH DIE APP (Fehlercodes): EXERCISE_POSE_INVALID = Winkel außerhalb des Bereichs, Kontakt schwebt/steckt, Hände/Füße zu weit
nachgeführt, Körperteil im Boden, Bilder zu ähnlich, Aktivierung für nicht beschriebenen Muskel. EXERCISE_POSE_WARNING = Schwerpunkt
außerhalb der Stützfläche oder Zwischenbild taucht in den Boden. Bei Fehlern meldet die App Pfad und Grund – korrigiere genau diese Werte.

SELBSTKONTROLLE vor der Ausgabe: Stimmt die Körperlage (pelvis)? Erreichen die Kontaktpunkte mit den angegebenen Winkeln die Fläche
(Beinlänge ${DIMS.thigh + DIMS.shank} cm, Armlänge ca. ${DIMS.upperArm + DIMS.forearm + 8} cm)? Sind alle Winkel im Bereich? Unterscheiden sich die Bilder sichtbar?`;
