import type { MetadataRoute } from "next";
import { getSiteUrl } from "../lib/seo";

// Only the landing page is indexed; the app routes are noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/", getSiteUrl()).toString(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}