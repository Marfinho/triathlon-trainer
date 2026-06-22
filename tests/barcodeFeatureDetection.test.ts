import { describe, it, expect, afterEach, vi } from "vitest";
import { detectBarcodeSupport } from "@/lib/barcode/feature-detection";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detectBarcodeSupport", () => {
  it("meldet keine native Unterstützung ohne sicheren Kontext", async () => {
    vi.stubGlobal("window", { isSecureContext: false, BarcodeDetector: class {} });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });

    const support = await detectBarcodeSupport();
    expect(support.secureContext).toBe(false);
    expect(support.nativeDetector).toBe(false);
  });

  it("meldet keine native Unterstützung ohne getUserMedia", async () => {
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("navigator", {});

    const support = await detectBarcodeSupport();
    expect(support.hasCamera).toBe(false);
  });

  it("nutzt getSupportedFormats(), wenn vorhanden, und akzeptiert nur bei ean_13", async () => {
    const getSupportedFormats = vi.fn().mockResolvedValue(["qr_code"]);
    vi.stubGlobal("window", {
      isSecureContext: true,
      BarcodeDetector: { getSupportedFormats },
    });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });

    const support = await detectBarcodeSupport();
    expect(getSupportedFormats).toHaveBeenCalled();
    expect(support.nativeDetector).toBe(false);
  });

  it("meldet native Unterstützung, wenn ean_13 in getSupportedFormats() enthalten ist", async () => {
    vi.stubGlobal("window", {
      isSecureContext: true,
      BarcodeDetector: { getSupportedFormats: vi.fn().mockResolvedValue(["ean_13", "qr_code"]) },
    });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });

    const support = await detectBarcodeSupport();
    expect(support.nativeDetector).toBe(true);
  });

  it("nimmt optimistisch Unterstützung an, wenn getSupportedFormats() fehlt", async () => {
    vi.stubGlobal("window", { isSecureContext: true, BarcodeDetector: class {} });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });

    const support = await detectBarcodeSupport();
    expect(support.nativeDetector).toBe(true);
  });
});
