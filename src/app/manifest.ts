import type { MetadataRoute } from "next";

/**
 * Web-App-Manifest: macht Brick auf Mobil & Desktop installierbar
 * („Zum Startbildschirm hinzufügen"), inkl. eigenständigem App-Fenster und
 * Direktstart ins Dashboard.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brick – Triathlon Training",
    short_name: "Brick",
    description:
      "Das Fundament für deinen KI-Trainingsplan: Daten, Plan, Form und Analyse für Triathlon.",
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
