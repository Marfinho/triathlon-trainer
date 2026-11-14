/**
 * Smarttrainer-Client über die Web Bluetooth API.
 *
 * Läuft ausschließlich im Browser (Chrome/Edge, sicherer Kontext: HTTPS oder
 * localhost). Erkennt das Steuerprotokoll des Geräts automatisch:
 *
 *   1. FTMS (0x1826)            – fast alle aktuellen Trainer (Kickr, Tacx Neo, Elite, JetBlack …)
 *   2. ANT+ FE-C über BLE       – ältere Tacx (Flux, Vortex, …)         [nicht an Hardware getestet]
 *   3. Wahoo-Legacy (a026ee0b)  – ältere KICKR/Snap ohne FTMS           [nicht an Hardware getestet]
 *   4. Cycling Power (0x1818)   – nur Messen (z. B. Powermeter), keine Steuerung
 *
 * Die Klasse heißt aus Kompatibilitätsgründen weiter `KickrTrainer`. Die reine
 * Protokoll-Logik liegt in ftms.ts / fec.ts / wahooLegacy.ts / cps.ts.
 */

import {
  FTMS_SERVICE,
  FTMS_CONTROL_POINT,
  FTMS_INDOOR_BIKE_DATA,
  FTMS_POWER_RANGE,
  ControlOpCode,
  ControlResultCode,
  buildRequestControl,
  buildStartOrResume,
  buildStopOrPause,
  buildSetTargetPower,
  parseControlResponse,
  parseIndoorBikeData,
  parseSupportedPowerRange,
  type IndoorBikeData,
} from "./ftms";
import { CPS_SERVICE, CPS_MEASUREMENT, parseCyclingPower, cadenceFromCrank } from "./cps";
import { FEC_SERVICE, FEC_NOTIFY, FEC_WRITE, buildFecTargetPower, parseFecFrame } from "./fec";
import { WAHOO_SERVICE, WAHOO_CONTROL, buildWahooUnlock, buildWahooSetErg } from "./wahooLegacy";

export type TrainerConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export type TrainerProtocol = "ftms" | "fec" | "wahoo" | "power-only";

export interface TrainerInfo {
  protocol: TrainerProtocol;
  deviceName: string;
  /** false = nur Messwerte; Ziel-Watt muss am Gerät/Schaltung manuell gefahren werden. */
  canControl: boolean;
  /** Hinweis für den Nutzer (z. B. warum keine Steuerung möglich ist). */
  note?: string;
}

export interface KickrTrainerCallbacks {
  onData?: (data: IndoorBikeData) => void;
  onStatus?: (status: TrainerConnectionStatus, message?: string) => void;
  onInfo?: (info: TrainerInfo) => void;
}

export interface ConnectOptions {
  /** Alle BLE-Geräte anzeigen (für Trainer, die ihre Dienste nicht bewerben). */
  showAllDevices?: boolean;
}

/** Prüft, ob Web Bluetooth im aktuellen Browser verfügbar ist. */
export function isWebBluetoothAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.bluetooth !== "undefined"
  );
}

const ALL_SERVICES: BluetoothServiceUUID[] = [
  FTMS_SERVICE,
  FEC_SERVICE,
  WAHOO_SERVICE,
  CPS_SERVICE,
];

export class KickrTrainer {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private ftmsControl: BluetoothRemoteGATTCharacteristic | null = null;
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyChars: BluetoothRemoteGATTCharacteristic[] = [];
  private protocol: TrainerProtocol | null = null;
  private canControlFlag = false;
  private lastSentWatts: number | null = null;
  private lastRequestedWatts: number | null = null;
  private powerRange: { minW: number; maxW: number } | null = null;
  /** Zusammengeführter Live-Zustand (Felder aus mehreren Paketen/Quellen). */
  private state: IndoorBikeData = {};
  private lastCrank: { revs: number; time: number } | null = null;
  /** GATT erlaubt nur eine laufende Operation – alle Schreibzugriffe seriell. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private callbacks: KickrTrainerCallbacks = {}) {}

  get connected(): boolean {
    return Boolean(this.server?.connected);
  }

  get canControl(): boolean {
    return this.canControlFlag;
  }

  private setStatus(status: TrainerConnectionStatus, message?: string) {
    this.callbacks.onStatus?.(status, message);
  }

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const run = this.queue.then(op, op);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private emit(patch: IndoorBikeData) {
    this.state = { ...this.state, ...patch };
    this.callbacks.onData?.({ ...this.state });
  }

  /** Fordert ein Gerät an, erkennt das Protokoll und bereitet die Steuerung vor. */
  async connect(options: ConnectOptions = {}): Promise<void> {
    if (!isWebBluetoothAvailable()) {
      this.setStatus("error", "Web Bluetooth wird in diesem Browser nicht unterstützt.");
      throw new Error("Web Bluetooth nicht verfügbar");
    }
    try {
      this.setStatus("connecting");
      this.device = await navigator.bluetooth.requestDevice(
        options.showAllDevices
          ? { acceptAllDevices: true, optionalServices: ALL_SERVICES }
          : {
              filters: ALL_SERVICES.map((s) => ({ services: [s] })),
              optionalServices: ALL_SERVICES,
            },
      );

      this.device.addEventListener("gattserverdisconnected", () => {
        this.resetConnectionState();
        this.setStatus("disconnected", "Verbindung getrennt.");
      });

      const server = await this.device.gatt!.connect();
      this.server = server;
      this.state = {};
      this.lastCrank = null;

      const info = await this.detectAndSetup(server);
      this.canControlFlag = info.canControl;
      this.protocol = info.protocol;
      this.callbacks.onInfo?.(info);
      this.setStatus("connected");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus("error", message);
      throw error;
    }
  }

  /** Probiert die Protokolle der Reihe nach; jeder Schritt nach dem ersten Treffer ist nicht fatal. */
  private async detectAndSetup(server: BluetoothRemoteGATTServer): Promise<TrainerInfo> {
    const deviceName = this.device?.name ?? "Unbekanntes Gerät";
    const tryService = async (uuid: BluetoothServiceUUID) => {
      try {
        return await server.getPrimaryService(uuid);
      } catch {
        return null;
      }
    };

    const ftms = await tryService(FTMS_SERVICE);
    if (ftms) {
      const info = await this.setupFtms(ftms, deviceName);
      if (info) return info;
    }

    const fec = await tryService(FEC_SERVICE);
    if (fec) {
      const info = await this.setupFec(fec, deviceName);
      if (info) return info;
    }

    const wahoo = await tryService(WAHOO_SERVICE);
    const cps = await tryService(CPS_SERVICE);
    if (wahoo || cps) {
      if (cps) await this.subscribeCps(cps).catch(() => {});
      if (wahoo) {
        const info = await this.setupWahoo(wahoo, cps, deviceName);
        if (info) return info;
      }
      if (cps) {
        return {
          protocol: "power-only",
          deviceName,
          canControl: false,
          note: "Dieses Gerät liefert nur Messwerte (Cycling Power). Die Ziel-Watt werden angezeigt, aber nicht gesteuert.",
        };
      }
    }
    throw new Error(
      "Kein unterstütztes Protokoll gefunden (FTMS, FE-C, Wahoo, Cycling Power). Tipp: „Alle Geräte anzeigen“ versuchen.",
    );
  }

  // ---------------------------------------------------------------- FTMS

  private async setupFtms(
    service: BluetoothRemoteGATTService,
    deviceName: string,
  ): Promise<TrainerInfo | null> {
    let bikeData: BluetoothRemoteGATTCharacteristic | null = null;
    try {
      bikeData = await service.getCharacteristic(FTMS_INDOOR_BIKE_DATA);
      await bikeData.startNotifications();
      bikeData.addEventListener("characteristicvaluechanged", this.handleBikeData);
      this.notifyChars.push(bikeData);
    } catch {
      bikeData = null;
    }
    if (!bikeData) {
      // Kein Indoor Bike Data: Messwerte ggf. über Cycling Power holen.
      const cps = await this.server?.getPrimaryService(CPS_SERVICE).catch(() => null);
      if (cps) await this.subscribeCps(cps).catch(() => {});
    }

    let control: BluetoothRemoteGATTCharacteristic | null = null;
    try {
      control = await service.getCharacteristic(FTMS_CONTROL_POINT);
      // Laut Spezifikation müssen Control-Point-Indications vor dem ersten Schreiben aktiv sein.
      await control.startNotifications();
      control.addEventListener("characteristicvaluechanged", this.handleControlResponse);
      this.notifyChars.push(control);
      this.ftmsControl = control;
    } catch {
      control = null;
    }

    try {
      const rangeChar = await service.getCharacteristic(FTMS_POWER_RANGE);
      const value = await rangeChar.readValue();
      const range = parseSupportedPowerRange(value);
      if (range) this.powerRange = { minW: range.minW, maxW: range.maxW };
    } catch {
      /* optional */
    }

    let canControl = false;
    let note: string | undefined;
    if (control) {
      try {
        await this.writeFtms(buildRequestControl());
        await this.writeFtms(buildStartOrResume());
        canControl = true;
      } catch (e) {
        note = `Steuerung nicht möglich (${e instanceof Error ? e.message : String(e)}). Nur Messwerte.`;
      }
    } else {
      note = "Gerät bietet keinen Control Point – nur Messwerte.";
    }
    if (!canControl && !bikeData && !this.notifyChars.length) return null;
    return { protocol: "ftms", deviceName, canControl, note };
  }

  private handleBikeData = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    this.emit(parseIndoorBikeData(target.value));
  };

  private handleControlResponse = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    const res = parseControlResponse(target.value);
    if (!res.isResponse || res.success) return;
    // Kontrolle verloren (z. B. nach Reset durch das Gerät): neu anfordern und Ziel erneut senden.
    if (
      res.resultCode === ControlResultCode.ControlNotPermitted &&
      res.requestOpCode === ControlOpCode.SetTargetPower
    ) {
      const watts = this.lastRequestedWatts;
      this.lastSentWatts = null;
      void this.enqueue(async () => {
        await this.writeFtms(buildRequestControl());
        await this.writeFtms(buildStartOrResume());
        if (watts != null) await this.writeFtms(buildSetTargetPower(this.clamp(watts)));
      }).catch(() => {});
    }
  };

  private async writeFtms(payload: Uint8Array): Promise<void> {
    await this.writeTo(this.ftmsControl, payload);
  }

  private async writeTo(
    char: BluetoothRemoteGATTCharacteristic | null,
    payload: Uint8Array,
  ): Promise<void> {
    if (!char) throw new Error("Nicht verbunden.");
    if (typeof char.writeValueWithResponse === "function") {
      await char.writeValueWithResponse(payload as BufferSource);
    } else {
      await char.writeValue(payload as BufferSource);
    }
  }

  // ---------------------------------------------------------------- FE-C

  private async setupFec(
    service: BluetoothRemoteGATTService,
    deviceName: string,
  ): Promise<TrainerInfo | null> {
    try {
      const notify = await service.getCharacteristic(FEC_NOTIFY);
      await notify.startNotifications();
      notify.addEventListener("characteristicvaluechanged", this.handleFec);
      this.notifyChars.push(notify);
      this.writeChar = await service.getCharacteristic(FEC_WRITE);
      return { protocol: "fec", deviceName, canControl: true };
    } catch {
      return null;
    }
  }

  private handleFec = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    const d = parseFecFrame(target.value);
    if (!d) return;
    this.emit({
      ...(d.powerW != null ? { instantaneousPowerW: d.powerW } : {}),
      ...(d.cadenceRpm != null ? { instantaneousCadenceRpm: d.cadenceRpm } : {}),
    });
  };

  // ---------------------------------------------------- Wahoo / Cycling Power

  private async setupWahoo(
    wahoo: BluetoothRemoteGATTService,
    cps: BluetoothRemoteGATTService | null,
    deviceName: string,
  ): Promise<TrainerInfo | null> {
    // Auf welchem Service die Control-Characteristic liegt, variiert je nach Quelle/Firmware.
    for (const svc of [wahoo, cps]) {
      if (!svc) continue;
      try {
        const ch = await svc.getCharacteristic(WAHOO_CONTROL);
        await this.writeTo(ch, buildWahooUnlock());
        this.writeChar = ch;
        return { protocol: "wahoo", deviceName, canControl: true };
      } catch {
        /* nächster Service */
      }
    }
    return null;
  }

  private async subscribeCps(service: BluetoothRemoteGATTService): Promise<void> {
    const ch = await service.getCharacteristic(CPS_MEASUREMENT);
    await ch.startNotifications();
    ch.addEventListener("characteristicvaluechanged", this.handleCps);
    this.notifyChars.push(ch);
  }

  private handleCps = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    const d = parseCyclingPower(target.value);
    const patch: IndoorBikeData = { instantaneousPowerW: d.instantaneousPowerW };
    if (d.crankRevolutions != null && d.lastCrankEventTime != null) {
      const curr = { revs: d.crankRevolutions, time: d.lastCrankEventTime };
      const cadence = cadenceFromCrank(this.lastCrank, curr);
      this.lastCrank = curr;
      if (cadence != null) patch.instantaneousCadenceRpm = cadence;
    }
    this.emit(patch);
  };

  // ------------------------------------------------------------ Steuerung

  private clamp(watts: number): number {
    let w = Math.max(0, Math.round(watts));
    if (this.powerRange) w = Math.min(this.powerRange.maxW, Math.max(this.powerRange.minW, w));
    return w;
  }

  /** Setzt die Ziel-Leistung (ERG). Identische Folgewerte werden ignoriert; ohne Steuerung No-op. */
  setTargetPower(watts: number): Promise<void> {
    const w = this.clamp(watts);
    this.lastRequestedWatts = w;
    if (!this.canControlFlag) return Promise.resolve();
    return this.enqueue(async () => {
      if (this.lastSentWatts === w) return;
      await this.sendTarget(w);
      this.lastSentWatts = w;
    });
  }

  private async sendTarget(w: number): Promise<void> {
    switch (this.protocol) {
      case "ftms":
        return this.writeFtms(buildSetTargetPower(w));
      case "fec":
        return this.writeTo(this.writeChar, buildFecTargetPower(w));
      case "wahoo":
        return this.writeTo(this.writeChar, buildWahooSetErg(w));
      default:
        return;
    }
  }

  /** Training starten bzw. nach Pause fortsetzen. */
  start(): Promise<void> {
    if (!this.canControlFlag) return Promise.resolve();
    return this.enqueue(async () => {
      if (this.protocol === "ftms") await this.writeFtms(buildStartOrResume());
      this.lastSentWatts = null; // nach Pause/Resume Ziel garantiert neu senden
    });
  }

  pause(): Promise<void> {
    if (!this.canControlFlag) return Promise.resolve();
    return this.enqueue(async () => {
      if (this.protocol === "ftms") await this.writeFtms(buildStopOrPause(true));
      else await this.sendTarget(0);
      this.lastSentWatts = null;
    });
  }

  stop(): Promise<void> {
    if (!this.canControlFlag) return Promise.resolve();
    return this.enqueue(async () => {
      if (this.protocol === "ftms") await this.writeFtms(buildStopOrPause(false));
      else await this.sendTarget(0);
      this.lastSentWatts = null;
    });
  }

  private resetConnectionState() {
    this.ftmsControl = null;
    this.writeChar = null;
    this.notifyChars = [];
    this.protocol = null;
    this.canControlFlag = false;
    this.lastSentWatts = null;
    this.lastRequestedWatts = null;
    this.powerRange = null;
    this.state = {};
    this.lastCrank = null;
  }

  async disconnect(): Promise<void> {
    try {
      for (const ch of this.notifyChars) {
        for (const h of [
          this.handleBikeData,
          this.handleControlResponse,
          this.handleFec,
          this.handleCps,
        ]) {
          ch.removeEventListener("characteristicvaluechanged", h);
        }
        await ch.stopNotifications().catch(() => {});
      }
      this.server?.disconnect();
    } finally {
      this.resetConnectionState();
      this.server = null;
      this.setStatus("disconnected");
    }
  }
}
