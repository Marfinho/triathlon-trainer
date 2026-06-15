/**
 * FTMS (Fitness Machine Service) – reine Protokoll-Hilfen für die ERG-Steuerung
 * eines Smarttrainers (z.B. Wahoo Kickr Core v2) über Bluetooth.
 *
 * Diese Datei enthält KEINE Bluetooth-Aufrufe – nur das Bauen von Befehls-Bytes
 * und das Parsen der Live-Datenpakete. Dadurch vollständig unit-testbar.
 *
 * Referenz: Bluetooth SIG "Fitness Machine Service" / "Indoor Bike Data".
 */

/** Standard-GATT-UUIDs (16-bit, von Web Bluetooth als Zahl akzeptiert). */
export const FTMS_SERVICE = 0x1826;
export const FTMS_CONTROL_POINT = 0x2ad9; // Fitness Machine Control Point
export const FTMS_INDOOR_BIKE_DATA = 0x2ad2; // Indoor Bike Data
export const FTMS_STATUS = 0x2ada; // Fitness Machine Status
export const FTMS_FEATURE = 0x2acc; // Fitness Machine Feature

/** Op-Codes des Fitness Machine Control Point. */
export const ControlOpCode = {
  RequestControl: 0x00,
  Reset: 0x01,
  SetTargetPower: 0x05,
  StartOrResume: 0x07,
  StopOrPause: 0x08,
  ResponseCode: 0x80,
} as const;

/** Ergebnis-Codes in der Control-Point-Antwort. */
export const ControlResultCode = {
  Success: 0x01,
  OpCodeNotSupported: 0x02,
  InvalidParameter: 0x03,
  OperationFailed: 0x04,
  ControlNotPermitted: 0x05,
} as const;

/** `[0x00]` – Kontrolle anfordern (vor dem Setzen von Zielwerten nötig). */
export function buildRequestControl(): Uint8Array {
  return new Uint8Array([ControlOpCode.RequestControl]);
}

/** `[0x07]` – Training starten/fortsetzen. */
export function buildStartOrResume(): Uint8Array {
  return new Uint8Array([ControlOpCode.StartOrResume]);
}

/** `[0x08, 0x01|0x02]` – Stop (0x01) oder Pause (0x02). */
export function buildStopOrPause(pause = false): Uint8Array {
  return new Uint8Array([ControlOpCode.StopOrPause, pause ? 0x02 : 0x01]);
}

/** `[0x01]` – Reset. */
export function buildReset(): Uint8Array {
  return new Uint8Array([ControlOpCode.Reset]);
}

/**
 * `[0x05, lo, hi]` – Ziel-Leistung in Watt setzen (ERG-Modus). Watt wird auf
 * eine nicht-negative Ganzzahl gerundet und als 16-bit little-endian kodiert.
 */
export function buildSetTargetPower(watts: number): Uint8Array {
  const w = Math.max(0, Math.min(0xffff, Math.round(watts)));
  return new Uint8Array([
    ControlOpCode.SetTargetPower,
    w & 0xff,
    (w >> 8) & 0xff,
  ]);
}

export interface ControlPointResponse {
  isResponse: boolean;
  requestOpCode: number;
  resultCode: number;
  success: boolean;
}

/** Parst eine Antwort des Control Points (`0x80, reqOp, result`). */
export function parseControlResponse(
  data: DataView | Uint8Array,
): ControlPointResponse {
  const view = toDataView(data);
  const responseOp = view.byteLength > 0 ? view.getUint8(0) : 0;
  const requestOpCode = view.byteLength > 1 ? view.getUint8(1) : 0;
  const resultCode = view.byteLength > 2 ? view.getUint8(2) : 0;
  return {
    isResponse: responseOp === ControlOpCode.ResponseCode,
    requestOpCode,
    resultCode,
    success: resultCode === ControlResultCode.Success,
  };
}

export interface IndoorBikeData {
  instantaneousSpeedKmh?: number;
  averageSpeedKmh?: number;
  instantaneousCadenceRpm?: number;
  averageCadenceRpm?: number;
  totalDistanceM?: number;
  resistanceLevel?: number;
  instantaneousPowerW?: number;
  averagePowerW?: number;
  heartRateBpm?: number;
  elapsedTimeSec?: number;
  remainingTimeSec?: number;
}

// Flag-Bits des Indoor Bike Data Pakets.
const FLAG_MORE_DATA = 1 << 0; // wenn 0: Instantaneous Speed vorhanden
const FLAG_AVG_SPEED = 1 << 1;
const FLAG_INST_CADENCE = 1 << 2;
const FLAG_AVG_CADENCE = 1 << 3;
const FLAG_TOTAL_DISTANCE = 1 << 4;
const FLAG_RESISTANCE = 1 << 5;
const FLAG_INST_POWER = 1 << 6;
const FLAG_AVG_POWER = 1 << 7;
const FLAG_EXPENDED_ENERGY = 1 << 8;
const FLAG_HEART_RATE = 1 << 9;
const FLAG_METABOLIC_EQUIV = 1 << 10;
const FLAG_ELAPSED_TIME = 1 << 11;
const FLAG_REMAINING_TIME = 1 << 12;

/**
 * Parst ein "Indoor Bike Data" Notification-Paket gemäß der flag-gesteuerten
 * Feldreihenfolge der FTMS-Spezifikation.
 */
export function parseIndoorBikeData(
  data: DataView | Uint8Array,
): IndoorBikeData {
  const view = toDataView(data);
  const flags = view.getUint16(0, true);
  let offset = 2;
  const result: IndoorBikeData = {};

  const readU16 = () => {
    const v = view.getUint16(offset, true);
    offset += 2;
    return v;
  };
  const readS16 = () => {
    const v = view.getInt16(offset, true);
    offset += 2;
    return v;
  };
  const readU24 = () => {
    const lo = view.getUint16(offset, true);
    const hi = view.getUint8(offset + 2);
    offset += 3;
    return lo + (hi << 16);
  };
  const readU8 = () => {
    const v = view.getUint8(offset);
    offset += 1;
    return v;
  };

  // Instantaneous Speed ist vorhanden, wenn das "More Data"-Bit NICHT gesetzt ist.
  if ((flags & FLAG_MORE_DATA) === 0) {
    result.instantaneousSpeedKmh = readU16() / 100;
  }
  if (flags & FLAG_AVG_SPEED) result.averageSpeedKmh = readU16() / 100;
  if (flags & FLAG_INST_CADENCE) result.instantaneousCadenceRpm = readU16() / 2;
  if (flags & FLAG_AVG_CADENCE) result.averageCadenceRpm = readU16() / 2;
  if (flags & FLAG_TOTAL_DISTANCE) result.totalDistanceM = readU24();
  if (flags & FLAG_RESISTANCE) result.resistanceLevel = readS16();
  if (flags & FLAG_INST_POWER) result.instantaneousPowerW = readS16();
  if (flags & FLAG_AVG_POWER) result.averagePowerW = readS16();
  if (flags & FLAG_EXPENDED_ENERGY) {
    // Total Energy (u16), Energy/Hour (u16), Energy/Minute (u8)
    offset += 5;
  }
  if (flags & FLAG_HEART_RATE) result.heartRateBpm = readU8();
  if (flags & FLAG_METABOLIC_EQUIV) offset += 1;
  if (flags & FLAG_ELAPSED_TIME) result.elapsedTimeSec = readU16();
  if (flags & FLAG_REMAINING_TIME) result.remainingTimeSec = readU16();

  return result;
}

function toDataView(data: DataView | Uint8Array): DataView {
  if (data instanceof DataView) return data;
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}
