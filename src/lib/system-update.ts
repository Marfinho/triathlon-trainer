import { promises as fs } from "fs";
import path from "path";

/** Geteiltes Volume mit dem Updater-Dienst (siehe updater/updater.sh). */
const dir = () => process.env.UPDATE_DIR ?? "";

export type UpdateState = "idle" | "checking" | "running" | "success" | "error";

export interface UpdateStatus {
  state: UpdateState;
  message: string;
  current: string;
  latest: string;
  behind: number;
  latestSubject: string;
  updatedAt: string;
}

export interface UpdateView {
  /** false, wenn kein Updater-Dienst angebunden ist (z. B. lokale Entwicklung). */
  available: boolean;
  status: UpdateStatus | null;
  log: string;
}

export async function readUpdateView(): Promise<UpdateView> {
  const d = dir();
  if (!d) return { available: false, status: null, log: "" };
  let status: UpdateStatus | null = null;
  try {
    status = JSON.parse(await fs.readFile(path.join(d, "status.json"), "utf8")) as UpdateStatus;
  } catch {
    // Updater noch nicht bereit.
  }
  let log = "";
  try {
    log = (await fs.readFile(path.join(d, "update.log"), "utf8")).slice(-6000);
  } catch {
    // noch kein Update gelaufen
  }
  return { available: true, status, log };
}

/** Legt eine Anfrage für den Updater ab. */
export async function requestUpdateAction(action: "check" | "update"): Promise<void> {
  await fs.writeFile(path.join(dir(), "request"), action, "utf8");
}
