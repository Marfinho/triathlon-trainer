/* Entwicklungshilfe: prüft 3D-Übungen und schreibt eine Vorschau-HTML. */
import fs from "node:fs";
import { exercise3dDefinitionSchema } from "../../src/domain/exercises/body3d/schema";
import { validateExercise3d } from "../../src/domain/exercises/body3d/validate";
import { solvePose, forwardKinematics, contactPointWorld } from "../../src/domain/exercises/body3d/kinematics";
import { renderFrame3dSvg, renderHero3dSvg, renderFault3dSvg, renderPose3dSvg } from "../../src/domain/exercises/body3d/svg";

const file = process.argv[2];
const out = process.argv[3];
const list = JSON.parse(fs.readFileSync(file, "utf8"));
let html = `<html><head><style>
body{font:12px sans-serif;background:#fff}
.row{display:flex;gap:6px;margin:6px 0}.row svg{width:260px;border:1px solid #ccc;background:#f5f8fb}
.gnd{stroke:#9fb0bd;stroke-width:1}.prop{fill:#dce4ea;stroke:#9fb0bd;stroke-width:.6}
.b3o{fill:#111c27;stroke:#111c27;stroke-width:2.2;stroke-linejoin:round}.c-top{fill:#3d7ac4}.c-leg{fill:#33465c}.c-skin{fill:#e8bd99}.c-shoe{fill:#f5f3ee}.c-hair{fill:#3b2f29}
.gh3{fill:#3d7ac4;stroke:#3d7ac4;stroke-width:2;opacity:.25}
.b3m{stroke:none}.b3m.work{fill:#e5484d}.b3m.stabilize{fill:#e5484d}.b3m.stretch{fill:#2f8fe0;stroke:#1d5d99}.b3m.idle{fill:#c9a0a0}
.mk-c{fill:#fff;stroke:#9f1d23;stroke-width:1}.mk-c.stretch{stroke:#2f8fe0}.mk-t{font:700 5.6px sans-serif;fill:#9f1d23;text-anchor:middle;dominant-baseline:central}
</style></head><body>`;
for (const raw of list) {
  const p = exercise3dDefinitionSchema.safeParse(raw);
  if (!p.success) { console.log(raw.id, "SCHEMA", JSON.stringify(p.error.issues.slice(0, 5))); continue; }
  const def = p.data;
  const v = validateExercise3d(def);
  console.log(`\n== ${def.id}: ${v.errors.length} Fehler, ${v.warnings.length} Warnungen`);
  for (const e of [...v.errors, ...v.warnings]) console.log("  ", e.code, e.path, e.message);
  def.keyframes.forEach((k, i) => {
    const s = solvePose(k, def.props);
    const f = s.frames;
    const fmt = (v: number[]) => v.map((x) => x.toFixed(1)).join(",");
    console.log(`  kf${i} ik=${s.ikCorrection.toFixed(1)} P=${fmt(f.pelvis.origin)} T=${fmt(f.spine_up.origin)} kneeL=${fmt(f.shank_l.origin)} kneeR=${fmt(f.shank_r.origin)} ankL=${fmt(f.foot_l.origin)} ankR=${fmt(f.foot_r.origin)} shR=${fmt(f.upperarm_r.origin)} elR=${fmt(f.forearm_r.origin)}`);
    console.log("     contacts", s.contacts.map((c) => `${c.point}:${c.residual.toFixed(1)}`).join(" "));
    // Abweichung ohne IK (Becken so verschoben, dass der erste Kontakt passt)
    const raw = forwardKinematics(k.joints as never, [k.root?.x ?? 0, 0, k.root?.z ?? 0]);
    const pts = Object.keys(k.contacts).map((c) => [c, contactPointWorld(raw, c as never)] as const);
    console.log("     roh(y,x)", pts.map(([c, p]) => `${c}:${p[1].toFixed(1)}/${p[0].toFixed(1)}`).join(" "));
  });
  html += `<h3>${def.id}</h3><div class="row">${renderHero3dSvg(def)}${[0,1,2,3].map((i) => renderFrame3dSvg(def, i)).join("")}${renderFault3dSvg(def) ?? ""}</div>`;
  html += `<div class="row">${(["side","front","three_quarter"] as const).map((vw) => renderPose3dSvg(def, def.keyframes[1], { view: vw, mode: "muscles", label: vw })).join("")}</div>`;
}
fs.writeFileSync(out, html + "</body></html>");
