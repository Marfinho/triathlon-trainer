import type { Metadata, Viewport } from "next";
import { Inter, DM_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
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
  themeColor: "#0a84ff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${inter.variable} ${dmMono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
