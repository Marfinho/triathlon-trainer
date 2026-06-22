import type { Html5Qrcode } from "html5-qrcode";
import type { BarcodeEngine } from "./types";

let containerSeq = 0;

/**
 * Fallback-Engine über `html5-qrcode` für Browser ohne native
 * `BarcodeDetector`-Unterstützung (z.B. iOS Safari). Die Bibliothek wird
 * dynamisch importiert, damit sie nicht ins Bundle wandert, wenn die native
 * API ausreicht.
 */
export function createHtml5QrcodeEngine(): BarcodeEngine {
  let scanner: Html5Qrcode | null = null;

  return {
    kind: "html5-qrcode",
    async start(container, callbacks) {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      const elementId = `localhub-barcode-scanner-${++containerSeq}`;
      const target = document.createElement("div");
      target.id = elementId;
      target.className = "h-full w-full";
      container.replaceChildren(target);

      scanner = new Html5Qrcode(elementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8],
        verbose: false,
      });

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => callbacks.onResult({ code: decodedText }),
          () => {
            // Kein Code im aktuellen Frame – bei jeder Kamera-Aufnahme normal, kein Fehler.
          },
        );
      } catch (err) {
        scanner = null;
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    async stop() {
      if (!scanner) return;
      const active = scanner;
      scanner = null;
      try {
        await active.stop();
      } catch {
        // bereits gestoppt
      }
      try {
        active.clear();
      } catch {
        // ignore
      }
    },
  };
}
