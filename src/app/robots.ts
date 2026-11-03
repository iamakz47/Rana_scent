import type { MetadataRoute } from "next";
import { getSiteUrl, isIndexingEnabled } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexingEnabled()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/*/cart", "/*/wishlist", "/*/admin"] },
    sitemap: new URL("/sitemap.xml", getSiteUrl()).toString(),
  };
}
