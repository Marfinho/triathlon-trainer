export interface BarcodeFeatureSupport {
  secureContext: boolean;
  hasCamera: boolean;
  nativeDetector: boolean;
}

interface BarcodeDetectorResult {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
}

interface BarcodeDetectorCtor {
  new (options: { formats: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

/**
 * Prüft Kamera-/Scanner-Voraussetzungen rein per Feature-Detection, ohne
 * etwas zu starten. `nativeDetector` ist nur `true`, wenn die native API
 * existiert, ein sicherer Kontext vorliegt und `ean_13` nachweislich
 * unterstützt wird (sofern die Engine das introspizieren kann).
 */
export async function detectBarcodeSupport(): Promise<BarcodeFeatureSupport> {
  const secureContext = typeof window !== "undefined" && window.isSecureContext === true;
  const hasCamera =
    typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";

  let nativeDetector = false;
  if (secureContext && typeof window !== "undefined" && window.BarcodeDetector) {
    try {
      const formats = window.BarcodeDetector.getSupportedFormats
        ? await window.BarcodeDetector.getSupportedFormats()
        : ["ean_13", "ean_8"];
      nativeDetector = formats.includes("ean_13");
    } catch {
      nativeDetector = false;
    }
  }

  return { secureContext, hasCamera, nativeDetector };
}

export type { BarcodeDetectorCtor, BarcodeDetectorInstance, BarcodeDetectorResult };
