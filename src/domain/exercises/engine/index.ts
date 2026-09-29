/**
 * Figuren-Engine für Übungen (reines TypeScript, kein DOM). 1:1-Port der
 * Referenz `engine.js`; die Golden-Tests prüfen die Ausgabe byte-genau.
 * Alle Funktionen liefern Strings.
 */
export {
  renderHeroSvg,
  renderFrameSvg,
  renderFaultSvg,
  renderBodyAt,
  renderPlayerShellSvg,
  renderThumbSvg,
  phaseLabels,
  ARROW_MARKER_DEFS,
  VIEWBOX,
  GROUND_Y,
  type RenderBodyOptions,
} from "./render";
export { timelineAt, tempoTotal, ease, type TimelinePhase } from "./timeline";
export { escapeXml } from "./escape";
