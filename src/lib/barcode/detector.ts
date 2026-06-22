import { detectBarcodeSupport } from "./feature-detection";
import { createNativeBarcodeEngine } from "./native-detector";
import { createHtml5QrcodeEngine } from "./html5-qrcode-detector";
import type { BarcodeEngine } from "./types";

/**
 * Wählt die Scanner-Engine: native `BarcodeDetector`-API, wenn verfügbar und
 * `ean_13` unterstützt, sonst Fallback über `html5-qrcode`.
 */
export async function createBarcodeScannerEngine(): Promise<BarcodeEngine> {
  const support = await detectBarcodeSupport();
  return support.nativeDetector ? createNativeBarcodeEngine() : createHtml5QrcodeEngine();
}

export { detectBarcodeSupport } from "./feature-detection";
export type { BarcodeFeatureSupport } from "./feature-detection";
export type { BarcodeEngine, BarcodeEngineCallbacks, BarcodeEngineResult } from "./types";
