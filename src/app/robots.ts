import type { MetadataRoute } from "next";
import { getSiteUrl } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/login", "/user-data", "/api/"],
    },
    sitemap: new URL("/sitemap.xml", baseUrl).toString(),
  };
}
