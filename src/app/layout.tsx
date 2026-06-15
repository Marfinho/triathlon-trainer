import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LocalHub",
  description:
    "Datendrehscheibe für Triathlon-/Ausdauertraining. Coach = Nutzer + externes LLM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
