export type BarcodeEngineKind = "native" | "html5-qrcode";

export interface BarcodeEngineResult {
  code: string;
}

export interface BarcodeEngineCallbacks {
  onResult: (result: BarcodeEngineResult) => void;
  onError: (error: Error) => void;
}

/**
 * Einheitliche Schnittstelle für native und Fallback-Scanner-Engine, damit
 * Hook/Komponente nicht wissen müssen, welche Implementierung gerade läuft.
 */
export interface BarcodeEngine {
  kind: BarcodeEngineKind;
  start(container: HTMLDivElement, callbacks: BarcodeEngineCallbacks): Promise<void>;
  stop(): Promise<void>;
}
