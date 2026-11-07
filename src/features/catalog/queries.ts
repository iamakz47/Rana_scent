import { filterProducts, type CatalogFilter } from "./filters";
import { loadCatalog } from "./source";
import type { Category, Product } from "./types";

export { catalogFilterSchema, filterProducts, parseCatalogFilter, sortOptions } from "./filters";
export type { CatalogFilter, SortOption } from "./filters";

// Catalog read API. The source (Phase 1 sample data or published Supabase
// rows) is chosen in ./source; these signatures stay the same either way.

export async function listProducts(
  filter?: Partial<CatalogFilter> & { category?: string },
): Promise<Product[]> {
  const { products } = await loadCatalog();
  const { category, ...rest } = filter ?? {};
  const scoped = category ? products.filter((product) => product.categories?.includes(category)) : products;
  return filterProducts(scoped, { type: [], family: [], inStock: false, ...rest });
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  const { products } = await loadCatalog();
  return products.find((product) => product.slug === slug);
}

export async function getProductsBySlug(slugs: readonly string[]): Promise<Product[]> {
  const { products } = await loadCatalog();
  return slugs
    .map((slug) => products.find((product) => product.slug === slug))
    .filter((product): product is Product => Boolean(product));
}

// Enabled categories in admin-defined order.
export async function listCategories(): Promise<Category[]> {
  const { categories } = await loadCatalog();
  return categories.filter((category) => category.enabled).sort((a, b) => a.position - b.position);
}

export async function listHomeCategories(): Promise<Category[]> {
  return (await listCategories()).filter((category) => category.showOnHome);
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  const { categories } = await loadCatalog();
  return categories.find((category) => category.slug === slug && category.enabled);
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const score = (candidate: Product) =>
    (candidate.scentFamily && candidate.scentFamily === product.scentFamily ? 3 : 0) +
    (product.compatibleWith.includes(candidate.slug) ? 2 : 0) +
    (candidate.type === product.type ? 1 : 0) +
    candidate.spaces.filter((space) => product.spaces.includes(space)).length * 0.1;

  const { products } = await loadCatalog();
  return products
    .filter((candidate) => candidate.id !== product.id)
    .map((candidate) => ({ candidate, value: score(candidate) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
