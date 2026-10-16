import type { MetadataRoute } from "next";
import { getSiteUrl, type SeoPageKey } from "../lib/seo";

const publicPages: SeoPageKey[] = [
  "home",
  "kundali",
  "milan",
  "numerology",
  "mahadasha",
  "ai-friend",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();

  return publicPages.map((page) => ({
    url: new URL(page === "home" ? "/" : `/${page}`, baseUrl).toString(),
    changeFrequency: "monthly",
    priority: page === "home" ? 1 : 0.8,
  }));
}
