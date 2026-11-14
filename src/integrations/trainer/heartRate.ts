/**
 * Herzfrequenz-Gurt über Bluetooth (Heart Rate Service 0x180D, Characteristic
 * 0x2A37). Funktioniert mit praktisch allen BLE-Gurten (Polar H9/H10, Wahoo
 * TICKR, Garmin HRM, Coospo …). Unabhängig vom Trainer – eigene Verbindung.
 */

import { isWebBluetoothAvailable } from "./kickrClient";

export const HR_SERVICE = 0x180d;
export const HR_MEASUREMENT = 0x2a37;

export interface HeartRateReading {
  bpm: number;
  /** false, wenn der Gurt meldet „kein Hautkontakt“ (Wert unzuverlässig). */
  contact: boolean;
}

/**
 * Parst "Heart Rate Measurement": Flag-Bit 0 = 16-bit-Wert, Bits 1–2 = Sensorkontakt
 * (0b10 = Kontakt unterstützt, aber nicht erkannt).
 */
export function parseHeartRate(data: DataView | Uint8Array): HeartRateReading | null {
  const view =
    data instanceof DataView ? data : new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.byteLength < 2) return null;
  const flags = view.getUint8(0);
  const is16 = (flags & 0x01) !== 0;
  if (is16 && view.byteLength < 3) return null;
  const bpm = is16 ? view.getUint16(1, true) : view.getUint8(1);
  const contact = ((flags >> 1) & 0x03) !== 0x02;
  return { bpm, contact };
}

export type HeartRateStatus = "disconnected" | "connecting" | "connected" | "error";

export interface HeartRateCallbacks {
  /** `null` = kein gültiger Wert (kein Hautkontakt). */
  onBpm?: (bpm: number | null) => void;
  onStatus?: (status: HeartRateStatus, message?: string) => void;
}

export class HeartRateMonitor {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  constructor(private callbacks: HeartRateCallbacks = {}) {}

  get name(): string | null {
    return this.device?.name ?? null;
  }

  async connect(): Promise<void> {
    if (!isWebBluetoothAvailable()) {
      this.callbacks.onStatus?.("error", "Web Bluetooth wird in diesem Browser nicht unterstützt.");
      throw new Error("Web Bluetooth nicht verfügbar");
    }
    try {
      this.callbacks.onStatus?.("connecting");
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HR_SERVICE] }],
      });
      this.device.addEventListener("gattserverdisconnected", () => {
        this.characteristic = null;
        this.callbacks.onBpm?.(null);
        this.callbacks.onStatus?.("disconnected", "Herzfrequenz-Gurt getrennt.");
      });
      const server = await this.device.gatt!.connect();
      const service = await server.getPrimaryService(HR_SERVICE);
      this.characteristic = await service.getCharacteristic(HR_MEASUREMENT);
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener("characteristicvaluechanged", this.handle);
      this.callbacks.onStatus?.("connected");
    } catch (error) {
      this.callbacks.onStatus?.("error", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private handle = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    const r = parseHeartRate(target.value);
    if (!r) return;
    this.callbacks.onBpm?.(r.contact && r.bpm > 0 ? r.bpm : null);
  };

  async disconnect(): Promise<void> {
    try {
      if (this.characteristic) {
        this.characteristic.removeEventListener("characteristicvaluechanged", this.handle);
        await this.characteristic.stopNotifications().catch(() => {});
      }
      this.device?.gatt?.disconnect();
    } finally {
      this.characteristic = null;
      this.callbacks.onBpm?.(null);
      this.callbacks.onStatus?.("disconnected");
    }
  }
}
