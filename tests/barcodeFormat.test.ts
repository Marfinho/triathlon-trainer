import { describe, it, expect } from "vitest";
import { isSupportedEan, normalizeBarcode } from "@/domain/barcode/format";

describe("isSupportedEan", () => {
  it("akzeptiert EAN-13", () => {
    expect(isSupportedEan("4006381333634")).toBe(true);
  });

  it("akzeptiert EAN-8", () => {
    expect(isSupportedEan("96385074")).toBe(true);
  });

  it("lehnt andere Längen und Formate ab", () => {
    expect(isSupportedEan("12345")).toBe(false);
    expect(isSupportedEan("not-a-barcode")).toBe(false);
    expect(isSupportedEan("")).toBe(false);
  });
});

describe("normalizeBarcode", () => {
  it("entfernt Nicht-Ziffern", () => {
    expect(normalizeBarcode("400-6381-333634")).toBe("4006381333634");
  });
});
