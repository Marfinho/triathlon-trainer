import type { NextConfig } from "next";

// Im Dev-Modus benötigt Next.js (React Refresh / HMR) `eval`; in Produktion
// nicht. Daher wird `'unsafe-eval'` ausschließlich in der Entwicklung erlaubt,
// damit die Produktions-CSP streng bleibt.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

/**
 * Content-Security-Policy. Bewusst pragmatisch: Next.js injiziert Inline-
 * Bootstrap-Skripte und Tailwind Inline-Styles, daher 'unsafe-inline'. Der
 * Rest ist eng gefasst – `frame-ancestors 'none'` (Clickjacking-Schutz),
 * keine Objekte/Plugins, base-uri/form-action auf 'self'. Externe API-Calls
 * (LLM, Wetter, Intervals) laufen serverseitig und sind nicht CSP-relevant.
 */
const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
