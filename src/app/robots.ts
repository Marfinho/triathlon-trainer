import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/mail";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/legal/"], disallow: ["/api/", "/admin", "/dashboard", "/profile", "/auth/reset-password", "/auth/verify"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
