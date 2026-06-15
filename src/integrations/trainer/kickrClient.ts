/**
 * Kickr-/Smarttrainer-Client über die Web Bluetooth API (FTMS).
 *
 * Läuft ausschließlich im Browser (Chrome/Edge, sicherer Kontext: HTTPS oder
 * localhost). Kapselt Verbindung, ERG-Steuerung (Ziel-Watt) und Live-Daten.
 * Die reine Protokoll-Logik liegt in `ftms.ts` und ist separat getestet.
 */

import {
  FTMS_SERVICE,
  FTMS_CONTROL_POINT,
  FTMS_INDOOR_BIKE_DATA,
  buildRequestControl,
  buildStartOrResume,
  buildStopOrPause,
  buildSetTargetPower,
  parseIndoorBikeData,
  type IndoorBikeData,
} from "./ftms";

export type TrainerConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface KickrTrainerCallbacks {
  onData?: (data: IndoorBikeData) => void;
  onStatus?: (status: TrainerConnectionStatus, message?: string) => void;
}

/** Prüft, ob Web Bluetooth im aktuellen Browser verfügbar ist. */
export function isWebBluetoothAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.bluetooth !== "undefined"
  );
}

export class KickrTrainer {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private controlPoint: BluetoothRemoteGATTCharacteristic | null = null;
  private bikeData: BluetoothRemoteGATTCharacteristic | null = null;
  private lastSentWatts: number | null = null;

  constructor(private callbacks: KickrTrainerCallbacks = {}) {}

  get connected(): boolean {
    return Boolean(this.server?.connected);
  }

  private setStatus(status: TrainerConnectionStatus, message?: string) {
    this.callbacks.onStatus?.(status, message);
  }

  /** Fordert ein Gerät an, verbindet, fordert Kontrolle an und startet. */
  async connect(): Promise<void> {
    if (!isWebBluetoothAvailable()) {
      this.setStatus("error", "Web Bluetooth wird in diesem Browser nicht unterstützt.");
      throw new Error("Web Bluetooth nicht verfügbar");
    }
    try {
      this.setStatus("connecting");
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [FTMS_SERVICE] }],
        optionalServices: [FTMS_SERVICE],
      });

      this.device.addEventListener("gattserverdisconnected", () => {
        this.controlPoint = null;
        this.bikeData = null;
        this.lastSentWatts = null;
        this.setStatus("disconnected", "Verbindung getrennt.");
      });

      const server = await this.device.gatt!.connect();
      this.server = server;
      const service = await server.getPrimaryService(FTMS_SERVICE);

      this.controlPoint = await service.getCharacteristic(FTMS_CONTROL_POINT);
      this.bikeData = await service.getCharacteristic(FTMS_INDOOR_BIKE_DATA);

      await this.bikeData.startNotifications();
      this.bikeData.addEventListener(
        "characteristicvaluechanged",
        this.handleBikeData,
      );

      // ERG-Steuerung vorbereiten: Kontrolle anfordern + Training starten.
      await this.writeControl(buildRequestControl());
      await this.writeControl(buildStartOrResume());

      this.setStatus("connected");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus("error", message);
      throw error;
    }
  }

  private handleBikeData = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    this.callbacks.onData?.(parseIndoorBikeData(target.value));
  };

  private async writeControl(payload: Uint8Array): Promise<void> {
    if (!this.controlPoint) throw new Error("Nicht verbunden.");
    // Bevorzugt mit Bestätigung schreiben (Control Point erwartet Indication).
    if (typeof this.controlPoint.writeValueWithResponse === "function") {
      await this.controlPoint.writeValueWithResponse(payload as BufferSource);
    } else {
      await this.controlPoint.writeValue(payload as BufferSource);
    }
  }

  /** Setzt die Ziel-Leistung (ERG). Identische Folgewerte werden ignoriert. */
  async setTargetPower(watts: number): Promise<void> {
    const w = Math.max(0, Math.round(watts));
    if (this.lastSentWatts === w) return;
    await this.writeControl(buildSetTargetPower(w));
    this.lastSentWatts = w;
  }

  async start(): Promise<void> {
    await this.writeControl(buildStartOrResume());
  }

  async pause(): Promise<void> {
    await this.writeControl(buildStopOrPause(true));
  }

  async stop(): Promise<void> {
    await this.writeControl(buildStopOrPause(false));
    this.lastSentWatts = null;
  }

  async disconnect(): Promise<void> {
    try {
      if (this.bikeData) {
        this.bikeData.removeEventListener(
          "characteristicvaluechanged",
          this.handleBikeData,
        );
        await this.bikeData.stopNotifications().catch(() => {});
      }
      this.server?.disconnect();
    } finally {
      this.controlPoint = null;
      this.bikeData = null;
      this.server = null;
      this.lastSentWatts = null;
      this.setStatus("disconnected");
    }
  }
}
