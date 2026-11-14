/**
 * ANT+ FE-C über Bluetooth (Tacx Flux/Vortex/Neo-Familie u. ä.) – reine
 * Frame-Builder/Parser. Framing und Seiten laut Auuki (dvmarinoff/Auuki,
 * src/ble/fec) abgeglichen; NICHT an echter Hardware getestet.
 */

export const FEC_SERVICE = "6e40fec1-b5a3-f393-e0a9-e50e24dcca9e";
export const FEC_NOTIFY = "6e40fec2-b5a3-f393-e0a9-e50e24dcca9e";
export const FEC_WRITE = "6e40fec3-b5a3-f393-e0a9-e50e24dcca9e";

const SYNC = 0xa4;
const MSG_ACKNOWLEDGED_DATA = 0x4f;
const DEFAULT_CHANNEL = 5;

export function fecChecksum(bytes: ArrayLike<number>, length = bytes.length): number {
  let cs = 0;
  for (let i = 0; i < length; i++) cs ^= bytes[i];
  return cs & 0xff;
}

/** Packt 8 Payload-Bytes in einen 13-Byte-Acknowledged-Data-Frame. */
export function buildFecFrame(payload: number[], channel = DEFAULT_CHANNEL): Uint8Array {
  if (payload.length !== 8) throw new Error("FE-C-Payload muss 8 Bytes haben.");
  const frame = new Uint8Array(13);
  frame[0] = SYNC;
  frame[1] = 9;
  frame[2] = MSG_ACKNOWLEDGED_DATA;
  frame[3] = channel;
  frame.set(payload, 4);
  frame[12] = fecChecksum(frame, 12);
  return frame;
}

/** Data Page 0x31 (49) – Target Power, Einheit 0,25 W, uint16 LE in Payload-Byte 6–7. */
export function buildFecTargetPower(watts: number, channel = DEFAULT_CHANNEL): Uint8Array {
  const v = Math.max(0, Math.min(0xffff, Math.round(watts * 4)));
  return buildFecFrame([0x31, 0xff, 0xff, 0xff, 0xff, 0xff, v & 0xff, (v >> 8) & 0xff], channel);
}

export interface FecTrainerData {
  cadenceRpm?: number;
  powerW?: number;
}

/**
 * Parst Data Page 0x19 (Specific Trainer Data) aus einem Frame (Payload ab Byte 4):
 * Cadence = Payload[2], Momentanleistung = 12 Bit LE aus Payload[5] + (Payload[6] & 0x0F).
 * Andere Seiten → null.
 */
export function parseFecFrame(data: DataView | Uint8Array): FecTrainerData | null {
  const b =
    data instanceof DataView
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : data;
  if (b.length < 13 || b[0] !== SYNC) return null;
  if (fecChecksum(b, 12) !== b[12]) return null;
  if (b[4] !== 0x19) return null;
  return { cadenceRpm: b[6], powerW: b[9] | ((b[10] & 0x0f) << 8) };
}
