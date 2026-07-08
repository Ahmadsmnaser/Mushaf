import type { MetadataRoute } from "next";
import { PAGE_COUNT } from "@/lib/mushaf/source";
import { getCanonicalUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const pages: MetadataRoute.Sitemap = Array.from({ length: PAGE_COUNT }, (_, index) => {
    const pageNumber = index + 1;

    return {
      url: getCanonicalUrl(`/page/${pageNumber}`),
      lastModified,
      changeFrequency: "yearly",
      priority: pageNumber === 1 ? 0.9 : 0.7,
    };
  });

  return [
    {
      url: getCanonicalUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getCanonicalUrl("/privacy"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    ...pages,
  ];
}
