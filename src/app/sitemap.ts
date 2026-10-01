import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/mail";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  return ["/", "/auth/register", "/auth/login", "/legal/impressum", "/legal/datenschutz", "/legal/agb"].map((p) => ({
    url: `${base}${p}`,
  }));
}
