import type { MetadataRoute } from "next";

/**
 * Web-App-Manifest: macht LocalHub auf Mobil & Desktop installierbar
 * („Zum Startbildschirm hinzufügen"), inkl. eigenständigem App-Fenster und
 * Direktstart ins Dashboard.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LocalHub – Triathlon Training",
    short_name: "LocalHub",
    description:
      "Datendrehscheibe für Triathlon-/Ausdauertraining: Plan, Form, Analyse.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F6F3EE",
    theme_color: "#5B3DF5",
    lang: "de",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
