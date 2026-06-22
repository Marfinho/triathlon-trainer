const EAN_13_PATTERN = /^\d{13}$/;
const EAN_8_PATTERN = /^\d{8}$/;

/** Akzeptiert nur EAN-13 und EAN-8 – andere vom Scanner gelieferte Formate werden verworfen. */
export function isSupportedEan(code: string): boolean {
  return EAN_13_PATTERN.test(code) || EAN_8_PATTERN.test(code);
}

export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, "");
}
