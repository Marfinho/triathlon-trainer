/**
 * Erzeugt Golden-Dateien (erwartete Engine-Ausgabe) für eingebaute Übungen.
 *
 * Standard: schreibt NUR fehlende Dateien (neue Übungen). Bestehende Golden-
 * Dateien werden nie still überschrieben – dafür braucht es `--force <id>`
 * (und einen eigenen Commit mit Begründung, siehe docs/EXERCISES.md).
 *
 *   npx tsx scripts/generate-exercise-golden.ts            # nur fehlende
 *   npx tsx scripts/generate-exercise-golden.ts --force plank
 */
import fs from "node:fs";
import path from "node:path";
import { builtinExercises } from "../src/domain/exercises/library";
import {
  renderBodyAt,
  renderFaultSvg,
  renderFrameSvg,
  renderHeroSvg,
  timelineAt,
} from "../src/domain/exercises/engine";

const OUT = path.join(__dirname, "../tests/fixtures/exercises/golden");
const PLAYER_U = [0, 0.25, 0.5, 0.75, 1];
const TIMELINE_TAU = [0, 0.5, 1.5, 3, 4.2, 5.5, 9];

const args = process.argv.slice(2);
const forceIdx = args.indexOf("--force");
const forced = forceIdx >= 0 ? new Set(args.slice(forceIdx + 1)) : new Set<string>();

fs.mkdirSync(OUT, { recursive: true });
let written = 0;
for (const def of builtinExercises) {
  const file = path.join(OUT, `${def.id}.json`);
  if (fs.existsSync(file) && !forced.has(def.id)) continue;
  const golden = {
    id: def.id,
    hero: renderHeroSvg(def),
    frames: [0, 1, 2, 3].map((i) => renderFrameSvg(def, i)),
    fault: renderFaultSvg(def),
    player: PLAYER_U.map((u) => ({ u, svg: renderBodyAt(def, u) })),
    timeline: TIMELINE_TAU.map((tau) => ({ tau, ...timelineAt(def.tempo, tau) })),
  };
  fs.writeFileSync(file, JSON.stringify(golden));
  console.log(`✓ ${path.relative(process.cwd(), file)}`);
  written++;
}
console.log(written === 0 ? "Keine Golden-Datei geschrieben (alle vorhanden)." : `${written} Datei(en) geschrieben.`);
