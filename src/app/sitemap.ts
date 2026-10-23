import type { MetadataRoute } from "next";
import { getSiteUrl } from "../lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const pages: Array<{ path: string } & Omit<MetadataRoute.Sitemap[number], "url">> = [
    { path: "/", changeFrequency: "monthly", priority: 1 },
    { path: "/kundali", changeFrequency: "monthly", priority: 0.9 },
    { path: "/milan", changeFrequency: "monthly", priority: 0.8 },
    { path: "/numerology", changeFrequency: "monthly", priority: 0.8 },
    { path: "/mahadasha", changeFrequency: "monthly", priority: 0.8 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
    { path: "/refund", changeFrequency: "yearly", priority: 0.3 },
    { path: "/disclaimer", changeFrequency: "yearly", priority: 0.3 },
    { path: "/contact", changeFrequency: "yearly", priority: 0.3 },
  ];
  return pages.map(({ path, ...metadata }) => ({
    url: new URL(path, baseUrl).toString(),
    ...metadata,
  }));
}