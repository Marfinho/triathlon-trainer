/**
 * Cycling Power Service (0x1818) – reine Parser. Wird als Datenquelle für
 * Trainer genutzt, die kein FTMS-Indoor-Bike-Data liefern (z. B. ältere Wahoo,
 * reine Powermeter). Keine Bluetooth-Aufrufe.
 */

export const CPS_SERVICE = 0x1818;
export const CPS_MEASUREMENT = 0x2a63;

export interface CyclingPowerData {
  instantaneousPowerW: number;
  /** Kumulierte Kurbelumdrehungen (16 bit, rollt über) – für Trittfrequenz. */
  crankRevolutions?: number;
  /** Zeitpunkt der letzten Kurbel-Ereignisse in 1/1024 s (16 bit, rollt über). */
  lastCrankEventTime?: number;
}

export function parseCyclingPower(data: DataView | Uint8Array): CyclingPowerData {
  const view =
    data instanceof DataView ? data : new DataView(data.buffer, data.byteOffset, data.byteLength);
  const flags = view.getUint16(0, true);
  const result: CyclingPowerData = { instantaneousPowerW: view.getInt16(2, true) };
  let offset = 4;
  if (flags & (1 << 0)) offset += 1; // Pedal Power Balance
  if (flags & (1 << 2)) offset += 2; // Accumulated Torque
  if (flags & (1 << 4)) offset += 6; // Wheel Revolution Data (u32 + u16)
  if (flags & (1 << 5)) {
    result.crankRevolutions = view.getUint16(offset, true);
    result.lastCrankEventTime = view.getUint16(offset + 2, true);
  }
  return result;
}

/**
 * Trittfrequenz (rpm) aus zwei aufeinanderfolgenden Kurbel-Messungen.
 * Rollover-sicher; null, wenn keine neue Umdrehung (Stillstand) oder kein Zeitdelta.
 */
export function cadenceFromCrank(
  prev: { revs: number; time: number } | null,
  curr: { revs: number; time: number },
): number | null {
  if (!prev) return null;
  const dRevs = (curr.revs - prev.revs + 0x10000) % 0x10000;
  const dTime = (curr.time - prev.time + 0x10000) % 0x10000;
  if (dTime === 0) return null;
  return Math.round((dRevs / (dTime / 1024)) * 60);
}
