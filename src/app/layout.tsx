import type { Metadata, Viewport } from "next";
import { Inter, DM_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Expressive, freundliche Display-Schrift für Überschriften.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display-sans",
});
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "LocalHub",
  description:
    "Datendrehscheibe für Triathlon-/Ausdauertraining. Coach = Nutzer + externes LLM.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "LocalHub" },
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
