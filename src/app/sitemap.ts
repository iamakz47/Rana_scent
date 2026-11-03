import type { MetadataRoute } from "next";
import { listCategories, listProducts } from "@/features/catalog/queries";
import { locales } from "@/i18n/config";
import { getSiteUrl } from "@/lib/env";

const staticPaths = ["", "/shop", "/about", "/contact", "/faq", "/shipping-returns", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);
  const paths = [
    ...staticPaths,
    ...categories.map((category) => `/collections/${category.slug}`),
    ...products.map((product) => `/products/${product.slug}`),
  ];

  return paths.map((path) => ({
    url: new URL(`/${locales[0]}${path}`, base).toString(),
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [l, new URL(`/${l}${path}`, base).toString()])),
    },
  }));
}
