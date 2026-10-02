import { BODY_MODEL_URL, parseBodyModel, type BodyModelData } from "@/domain/exercises/body3d/bodyModel";

/** Körpermodell einmal pro Seite laden (geteilt von allen Viewern). */
let pending: Promise<BodyModelData | null> | null = null;

export function loadBodyModel(): Promise<BodyModelData | null> {
  if (!pending)
    pending = fetch(BODY_MODEL_URL)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(parseBodyModel)
      .catch(() => {
        pending = null; // nächster Versuch beim nächsten Viewer
        return null;
      });
  return pending;
}
