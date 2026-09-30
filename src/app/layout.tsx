import type { Metadata, Viewport } from "next";
import { Inter, DM_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Expressive, freundliche Display-Schrift für Überschriften. Lokal eingebunden
// (variable Schrift, Latin-Subset, SIL Open Font License), weil der Google-Fonts-
// Loader für diese Schrift im CI-Build nicht zuverlässig lief.
const bricolage = localFont({
  src: "./fonts/BricolageGrotesque-latin.woff2",
  weight: "500 800",
  display: "swap",
  variable: "--font-display-sans",
});
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "Brick",
  description:
    "Deine KI plant, Brick ist das Fundament: Trainingsdaten aus Intervals.icu für deine KI, ihr Plan zurück in deinen Kalender.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Brick" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0d16" },
  ],
  // Nötig, damit env(safe-area-inset-*) auf iPhones mit Home-Indicator greift.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${inter.variable} ${dmMono.variable} ${bricolage.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
