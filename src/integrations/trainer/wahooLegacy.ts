/**
 * Wahoo-Legacy-ERG (ältere KICKR/Snap ohne FTMS). Opcodes laut Auuki
 * (src/ble/wcps) abgeglichen; NICHT an echter Hardware getestet.
 */

export const WAHOO_SERVICE = "a026ee0b-0a7d-4ab3-97fa-f1500f9feb8b";
export const WAHOO_CONTROL = "a026e005-0a7d-4ab3-97fa-f1500f9feb8b";

/** Kontrolle freischalten. */
export function buildWahooUnlock(): Uint8Array {
  return new Uint8Array([0x20, 0xee, 0xfc]);
}

/** ERG-Ziel in Watt: `[0x42, lo, hi]`. */
export function buildWahooSetErg(watts: number): Uint8Array {
  const w = Math.max(0, Math.min(0xfffe, Math.round(watts)));
  return new Uint8Array([0x42, w & 0xff, (w >> 8) & 0xff]);
}
