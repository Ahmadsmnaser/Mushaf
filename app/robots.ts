import type { MetadataRoute } from "next";
import { getCanonicalUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getCanonicalUrl("/");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: getCanonicalUrl("/sitemap.xml"),
    host: siteUrl,
  };
}
